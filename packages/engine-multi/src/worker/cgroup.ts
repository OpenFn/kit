/**
 * cgroup v2 memory enforcement for pooled child processes.
 *
 * cgroup level memory enforcement allows us to enforce memory limits at the kernel level,
 * improving our ability to OOMKill runs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Logger } from '@openfn/logger';

const CGROUP_ROOT = '/sys/fs/cgroup';

// Default parent cgroup under which per-child leaf cgroups are created.
// Must be a path the worker process can write to (typically requires cgroup
// delegation in a container, or running as root).
export const DEFAULT_CGROUP_PARENT = path.join(CGROUP_ROOT, 'openfn');

export type CgroupHandle = {
  path: string; // absolute path to the leaf cgroup directory
  eventsPath: string; // absolute path to the leaf's memory.events file
};

// Returns true when cgroup v2 memory enforcement can be used under `parent`.
// Caches the result and warns (once per parent) when unavailable.
export const isCgroupV2Available = (
  parent: string,
  logger: Logger
): boolean => {
  if (parent in availabilityCache) {
    return availabilityCache[parent];
  }

  const available = detect(parent, logger);
  availabilityCache[parent] = available;
  if (!available) {
    logger.warn(
      'cgroup: v2 memory enforcement unavailable on this host; ' +
        'falling back to heap-limit only'
    );
  }
  return available;
};

// Create a leaf cgroup for `pid`, set its hard memory ceiling and move the
// process into it. Returns a handle, or null on any failure (best-effort).
export const createChildCgroup = (
  parent: string,
  pid: number,
  limitBytes: number,
  logger: Logger
): CgroupHandle | null => {
  const dir = path.join(parent, `run-${pid}`);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    fs.writeFileSync(path.join(dir, 'memory.max'), String(limitBytes));
    // Stop the process escaping the limit via swap. The swap controller may be
    // absent, so this is best-effort.
    try {
      fs.writeFileSync(path.join(dir, 'memory.swap.max'), '0');
    } catch (e) {
      // no swap controller; ignore
    }
    // Moving the pid in must come last: a cgroup with member processes cannot
    // have its controllers reconfigured.
    fs.writeFileSync(path.join(dir, 'cgroup.procs'), String(pid));
    logger.debug(
      `cgroup: constrained process ${pid} to ${limitBytes} bytes at ${dir}`
    );
    return { path: dir, eventsPath: path.join(dir, 'memory.events') };
  } catch (e) {
    logger.warn(
      `cgroup: failed to constrain process ${pid}: ${(e as Error).message}`
    );
    return null;
  }
};

// Returns true if the kernel OOM-killed anything in this cgroup. Used to tell a
// cgroup memory kill (a bare SIGKILL with no V8 message) apart from other crashes.
export const hasOomKill = (handle: CgroupHandle): boolean => {
  try {
    const content = fs.readFileSync(handle.eventsPath, 'utf8');
    for (const line of content.split('\n')) {
      const [key, value] = line.trim().split(/\s+/);
      if (
        (key === 'oom_kill' || key === 'oom_group_kill') &&
        parseInt(value, 10) > 0
      ) {
        return true;
      }
    }
  } catch (e) {
    // events file gone (cgroup already removed) or unreadable
  }
  return false;
};

// Remove a leaf cgroup. The cgroup can only be removed once empty, so we retry
// a handful of times while the killed process is reaped. Best-effort and
// non-blocking.
export const removeChildCgroup = (
  handle: CgroupHandle | null,
  logger: Logger,
  attempts = 10
) => {
  if (!handle) {
    return;
  }
  try {
    fs.rmdirSync(handle.path);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (attempts > 0 && (err.code === 'EBUSY' || err.code === 'ENOTEMPTY')) {
      setTimeout(() => removeChildCgroup(handle, logger, attempts - 1), 50);
      return;
    }
    if (err.code !== 'ENOENT') {
      logger.debug(`cgroup: could not remove ${handle.path}: ${err.message}`);
    }
  }
};

// For tests: clear the cached availability probes.
export const _resetAvailabilityCache = () => {
  for (const key of Object.keys(availabilityCache)) {
    delete availabilityCache[key];
  }
};

// Leaf cgroup into which we relocate any processes that sit in a cgroup we need
// to delegate the memory controller from (see enableMemoryController).
const LEADER_NAME = 'openfn-leader';

// Cache availability per parent so we only probe the filesystem (and warn) once.
const availabilityCache: Record<string, boolean> = {};

// True if a cgroup interface file (e.g. cgroup.controllers, subtree_control)
// lists the given whitespace-separated token.
function fileLists(file: string, token: string) {
  return fs.readFileSync(file, 'utf8').split(/\s+/).includes(token);
}

// Relocate every process in `dir` into a dedicated leader leaf cgroup, so `dir`
// itself becomes empty and its controllers can be delegated. This is the same
// move systemd/runc make; it includes the worker's own process when `dir` is
// the container's cgroup namespace root.
function moveProcsToLeader(dir: string, logger: Logger) {
  const leader = path.join(dir, LEADER_NAME);
  if (!fs.existsSync(leader)) {
    fs.mkdirSync(leader);
  }
  const procs = fs
    .readFileSync(path.join(dir, 'cgroup.procs'), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const pid of procs) {
    try {
      fs.writeFileSync(path.join(leader, 'cgroup.procs'), pid);
    } catch (e) {
      // Some processes (e.g. kernel threads) can't be moved; skip them.
      logger.debug(
        `cgroup: could not move pid ${pid} into leader: ${(e as Error).message}`
      );
    }
  }
}

// Enable the memory controller for the children of `dir` (idempotent).
function enableMemoryController(dir: string, logger: Logger) {
  const subtree = path.join(dir, 'cgroup.subtree_control');
  if (fileLists(subtree, 'memory')) {
    return;
  }
  try {
    fs.writeFileSync(subtree, '+memory');
  } catch (e) {
    // EBUSY means `dir` still holds member processes (cgroup v2's "no internal
    // processes" rule forbids delegating from a populated cgroup). This is the
    // common containerised case where the worker lives in the namespace root:
    // move those processes into a leader leaf, then retry the delegation.
    if ((e as NodeJS.ErrnoException).code === 'EBUSY') {
      logger.debug(
        `cgroup: ${dir} is populated; relocating processes to delegate memory`
      );
      moveProcsToLeader(dir, logger);
      fs.writeFileSync(subtree, '+memory');
    } else {
      throw e;
    }
  }
}

// Ensure the parent cgroup exists and delegates the memory controller all the
// way down from the cgroup root, so leaf cgroups created under it can set
// memory.max. Throws on any failure (caught by the caller).
function ensureParent(parent: string, logger: Logger) {
  const rel = path.relative(CGROUP_ROOT, parent);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`cgroup parent ${parent} is not under ${CGROUP_ROOT}`);
  }

  // Delegate the memory controller from the root down to (and including) the
  // parent, creating each intermediate cgroup as needed. Any process sitting in
  // a cgroup we delegate from (notably the worker itself, in the namespace
  // root) is relocated to a leader leaf first; processes otherwise only live in
  // the leaves below `parent`.
  enableMemoryController(CGROUP_ROOT, logger);
  let dir = CGROUP_ROOT;
  for (const segment of rel.split(path.sep).filter(Boolean)) {
    dir = path.join(dir, segment);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    enableMemoryController(dir, logger);
  }
}

function detect(parent: string, logger: Logger): boolean {
  if (os.platform() !== 'linux') {
    return false;
  }

  // cgroup v2 (the unified hierarchy) exposes cgroup.controllers at the root;
  // cgroup v1 does not.
  const rootControllers = path.join(CGROUP_ROOT, 'cgroup.controllers');
  if (!fs.existsSync(rootControllers)) {
    return false;
  }

  try {
    if (!fileLists(rootControllers, 'memory')) {
      return false;
    }
    ensureParent(parent, logger);
    return true;
  } catch (e) {
    logger.debug(
      `cgroup: setup of parent ${parent} failed: ${(e as Error).message}`
    );
    return false;
  }
}
