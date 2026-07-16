# Spec: delegated cgroup memory enforcement

Rework of the cgroup work on the `cgroup-oom-limit` branch (PR #1467).

## Motivation

The current implementation self-provisions the cgroup hierarchy: it walks down
from `/sys/fs/cgroup`, enables the memory controller at each level, creates
intermediate cgroups, and relocates any processes it finds in the root cgroup
into a leader leaf. This:

- requires root
- mutates cgroup topology the engine does not own (on non-systemd hosts or
  WSL2 it can relocate unrelated system processes)
- makes the availability "probe" a side-effecting operation
- conflicts with systemd's single-writer rule when creating cgroups directly
  under the host root

## Design

Invert the responsibility. The engine never provisions the hierarchy; it
consumes a **delegated** cgroup provided by the environment.

**Contract**: the worker process must be *started inside* a writable cgroup v2
subtree that has the memory controller available. Whoever starts the worker
(systemd, Docker, a launcher script) is responsible for that. If the contract
isn't met, the engine warns once and falls back to heap-limit-only behaviour.

This works because processes are always born inside their supervisor's cgroup:

| Environment | Setup required | How the worker ends up inside |
| --- | --- | --- |
| Docker / K8s | None to create; grant a writable cgroup mount (`--privileged`, or Podman/crun which mounts rw by default). Unprivileged Docker mounts `/sys/fs/cgroup` read-only → clean fallback | Container processes are born in the container's cgroup (= namespace root) |
| systemd host | Unit with `User=openfn` and `Delegate=memory` (systemd creates the cgroup, chowns it to the user) | Service is born in its delegated cgroup |
| Manual (no systemd) | Root: `mkdir` the cgroup; `chown` the dir, `cgroup.procs` and `cgroup.subtree_control` to the worker user | Root launcher writes `$$` into `cgroup.procs`, drops privileges, `exec`s node |
| Local dev | None | Own cgroup isn't writable → warn + fallback |

**Default parent = the worker's own cgroup**, resolved from
`/proc/self/cgroup` (the `0::<path>` line, joined onto `/sys/fs/cgroup`).
This makes all rows above work with identical logic and no configuration.
`cgroupParent` / `--cgroup-parent` remains as an override, but note the kernel
migration rule: moving a pid between cgroups requires write access to the
*common ancestor's* `cgroup.procs`, so pointing the worker at a subtree it
doesn't live inside only works when running as root.

### Startup sequence (all writes confined to the parent)

1. **Detect**: Linux; parent dir exists; `<parent>/cgroup.controllers` lists
   `memory`; parent is writable. No mutation. Any failure → warn once,
   fall back.
2. **Prepare** (first use): move the processes currently in the parent (within
   a delegated subtree these can only be the worker's own) into a
   `<parent>/leader` leaf — required by the no-internal-processes rule — then
   write `+memory` to `<parent>/cgroup.subtree_control`. Failure → warn,
   fall back.
3. **Per child fork**: `mkdir <parent>/run-<pid>`; write `memory.max`
   (`cgroupMemoryLimitMb`); write `memory.swap.max = 0` (best-effort); write
   the pid to `cgroup.procs` last. Failure → warn, run continues heap-only.
4. **On unexpected child exit**: read the leaf's `memory.events`; if
   `oom_kill > 0`, reject with `OOMError('cgroup')` before falling back to the
   stderr heap-message scrape. (Unchanged from the current branch.)
5. **Cleanup**: remove the leaf on kill/timeout/destroy, retrying briefly on
   `EBUSY`/`ENOTEMPTY`. (Unchanged.)

## Code changes

### `packages/engine-multi/src/worker/cgroup.ts`

- Delete `ensureParent` and the root-walking/controller-enabling logic;
  `CGROUP_ROOT` is no longer written to, only used to resolve paths.
- Rescope `moveProcsToLeader` to operate only on the configured parent (step 2
  above); it must never be called on a directory outside the parent.
- Add `resolveSelfCgroup(): string | null` — parse `/proc/self/cgroup`,
  return the absolute path of the v2 cgroup, null if unavailable. This
  replaces `DEFAULT_CGROUP_PARENT` as the default.
- `detect` becomes read-only (step 1); the prepare step (2) runs lazily on
  first successful detection. Cache the result per parent as now.
- `createChildCgroup`, `hasOomKill`, `removeChildCgroup`: unchanged.

### `packages/engine-multi/src/worker/pool.ts`

- No behavioural change; the default parent now comes from
  `resolveSelfCgroup()` rather than a hardcoded path.

### `packages/ws-worker`

- `--cgroup-memory` unchanged: defaults to `run-memory + 128`, `0` disables
  (documented). Default-on is now safe because the failure mode is a warning,
  not host mutation.
- `--cgroup-parent` help text: default is the worker's own cgroup; overriding
  it generally requires root (common-ancestor rule).

### Error propagation (decide: this PR or follow-up)

`OOMError.source` (`'heap' | 'cgroup'`) currently dies at
`lifecycle.error()`, which only forwards `type`/`message`/`severity` — so
Lightning cannot distinguish the two cases. If the PR's "identifier" claim is
meant to reach Lightning, forward `source` through the `WORKFLOW_ERROR` event
and into the exit reason; otherwise soften the claim to "identifiable in
worker logs".

## Tests

- **Gate the enforcement tests on `isCgroupV2Available(...)`, not
  `os.platform() === 'linux'`.** As written they run on any Linux host —
  including CI runners and dev machines where cgroups are unavailable — and
  `blowNativeMemory` then allocates unbounded native memory with no limit of
  any kind.
- Unit tests (any platform): `resolveSelfCgroup` parsing (fixture strings);
  detection returns false without side effects when the parent is missing,
  read-only, or lacks the memory controller; existing null-handle tolerance
  tests stand.
- Enforcement tests (writable-cgroup hosts only): kernel OOM-kill surfaces
  `OOMError` with `source: 'cgroup'`; pool restores the slot and keeps
  working. Runnable locally via `docker run --privileged` (recipe stays in
  the test header); consider a privileged CI job later.

## Docs

- Rewrite the README "Memory Limits" section around the delegation contract
  and the setup table above.
- Deployment note: unprivileged Docker/K8s mounts `/sys/fs/cgroup` read-only,
  so enforcement needs `--privileged` (or Podman) — verify against the actual
  deployment infra before publishing ops guidance.

## Out of scope / open questions

- `memory.oom.group=1` on leaves — irrelevant while each leaf holds exactly
  one process; revisit if jobs ever spawn subprocesses.
- Tuning the `+128`mb headroom default: children are reused across runs, so
  native memory accumulates toward the ceiling; legitimate runs near the heap
  limit could be kernel-killed. May want a larger default or per-deployment
  guidance.
- Changeset still needed on the PR.
