/**
 * cgroup v2 memory enforcement for pooled child processes.
 *
 * cgroup level memory enforcement allows us to enforce memory limits at the kernel level,
 * improving our ability to OOMKill runs.
 *
 * cgroup enforcement is disabled by default because the worker needs to run in an appropriately delegated runtime. See readme.
 *
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Logger } from '@openfn/logger';

const CGROUP_ROOT = '/sys/fs/cgroup';

export type CgroupHandle = {
  path: string; // absolute path to the leaf cgroup directory
  eventsPath: string; // absolute path to the leaf's memory.events file
};

// Extract the cgroup v2 path (the "0::<path>" entry) from a /proc/self/cgroup
// listing and resolve it against the cgroup mount. Returns null if the process
// has no v2 cgroup (ie, a pure cgroup v1 host)
export const parseProcSelfCgroup = (content: string): string | null => {
  for (const line of content.split('\n')) {
    const match = line.match(/^0::(.+)$/);
    if (match) {
      // strip the trailing slash left by the namespace root case ("0::/")
      return path.join(CGROUP_ROOT, match[1]).replace(/(.)\/$/, '$1');
    }
  }
  return null;
};

// The cgroup this process was started in. This is the default parent for
// per-child leaves: under systemd Delegate= or in a container it is exactly
// the subtree that was handed to us. Returns null when it can't be determined
export const resolveSelfCgroup = (): string | null => {
  if (os.platform() !== 'linux') {
    return null;
  }
  try {
    const self = parseProcSelfCgroup(
      fs.readFileSync('/proc/self/cgroup', 'utf8')
    );
    // If we were started inside a leader leaf (eg, restarted from within an
    // already-prepared cgroup), the delegated parent is the enclosing cgroup
    if (self && path.basename(self) === LEADER_NAME) {
      return path.dirname(self);
    }
    return self;
  } catch (e) {
    return null;
  }
};

// Returns true when cgroup v2 memory enforcement can be used under `parent`.
// On first success this also prepares the parent (delegates the memory
// controller to its leaves). Caches the result and warns (once per parent)
// when unavailable
export const isCgroupV2Available = (
  parent: string | null,
  logger: Logger
): boolean => {
  const key = parent ?? '';
  if (key in availabilityCache) {
    return availabilityCache[key];
  }

  let available = false;
  if (parent && detect(parent, logger)) {
    try {
      prepare(parent, logger);
      available = true;
    } catch (e) {
      logger.debug(
        `cgroup: could not delegate memory controller in ${parent}: ${
          (e as Error).message
        }`
      );
    }
  }

  availabilityCache[key] = available;
  if (!available) {
    logger.warn(
      'cgroup: v2 memory enforcement unavailable; falling back to heap-limit only. ' +
        'To enable it, start the worker inside a writable, delegated cgroup ' +
        '(see the engine-multi README)'
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
      setTimeout(
        () => removeChildCgroup(handle, logger, attempts - 1),
        50
      ).unref();
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

// Leaf cgroup into which the worker relocates the processes in its own cgroup
// (typically just itself), so the memory controller can be delegated to the
// run leaves (see prepare)
const LEADER_NAME = 'leader';

// Cache availability per parent so we only probe the filesystem (and warn) once.
const availabilityCache: Record<string, boolean> = {};

// True if a cgroup interface file (e.g. cgroup.controllers, subtree_control)
// lists the given whitespace-separated token.
function fileLists(file: string, token: string) {
  return fs.readFileSync(file, 'utf8').split(/\s+/).includes(token);
}

// Relocate every process in `parent` into a leader leaf, so `parent` itself
// becomes empty and its controllers can be delegated. Within a delegated
// subtree the only member processes are our own (typically just the worker,
// when it was started inside `parent`)
function moveProcsToLeader(parent: string, logger: Logger) {
  const leader = path.join(parent, LEADER_NAME);
  if (!fs.existsSync(leader)) {
    fs.mkdirSync(leader);
  }
  const procs = fs
    .readFileSync(path.join(parent, 'cgroup.procs'), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const pid of procs) {
    try {
      fs.writeFileSync(path.join(leader, 'cgroup.procs'), pid);
    } catch (e) {
      // A process may exit between the read and the move; skip it and let the
      // subsequent subtree_control write decide whether the parent is empty
      logger.debug(
        `cgroup: could not move pid ${pid} into leader: ${(e as Error).message}`
      );
    }
  }
}

// Enable the memory controller for the leaves of `parent` (idempotent).
// cgroup v2's "no internal processes" rule forbids delegating controllers
// from a populated cgroup, and in the recommended setup the worker itself
// lives in `parent` - so on EBUSY, move its processes into a leader leaf
// and retry
function prepare(parent: string, logger: Logger) {
  const subtree = path.join(parent, 'cgroup.subtree_control');
  if (fileLists(subtree, 'memory')) {
    return;
  }
  try {
    fs.writeFileSync(subtree, '+memory');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EBUSY') {
      logger.debug(
        `cgroup: ${parent} is populated; relocating processes to a leader leaf`
      );
      moveProcsToLeader(parent, logger);
      fs.writeFileSync(subtree, '+memory');
    } else {
      throw e;
    }
  }
}

// Read-only check that `parent` is a usable delegated cgroup: a cgroup v2
// directory under the cgroup mount, writable by this process, with the memory
// controller available
function detect(parent: string, logger: Logger): boolean {
  if (os.platform() !== 'linux') {
    return false;
  }

  const rel = path.relative(CGROUP_ROOT, parent);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    logger.debug(`cgroup: parent ${parent} is not under ${CGROUP_ROOT}`);
    return false;
  }

  try {
    // cgroup v2 exposes cgroup.controllers in every cgroup; v1 does not
    const controllers = path.join(parent, 'cgroup.controllers');
    if (!fileLists(controllers, 'memory')) {
      logger.debug(`cgroup: memory controller not available in ${parent}`);
      return false;
    }
    // We need to create leaf dirs and move pids around within the parent
    fs.accessSync(parent, fs.constants.W_OK);
    fs.accessSync(path.join(parent, 'cgroup.procs'), fs.constants.W_OK);
    return true;
  } catch (e) {
    logger.debug(
      `cgroup: parent ${parent} is not usable: ${(e as Error).message}`
    );
    return false;
  }
}
