# Engine (@openfn/engine-multi)
Wraps @openfn/runtime to execute each workflow in an isolated worker_thread nested inside a pooled child_process, so concurrent runs can't corrupt or starve each other.

## Invariants
- Three-tier process tree: main process (engine) -> forked child_process (pool member) -> worker_thread (where @openfn/runtime actually runs). Each child hosts exactly one thread, spawned per task and terminated on completion.
- Everything crossing main<->child<->thread goes over Node IPC / postMessage and is structured-cloned. Only serializable data survives: no functions, closures, class instances, or live handles. This is why resolvers/credentials are preloaded on the main thread and the fully-resolved plan is sent in — you cannot call back into the parent mid-run.
- Errors must be plain serializable objects before crossing the boundary (use the error serializer); reconstruct Error instances on the parent side. Don't pass Error objects expecting stack/prototype to survive.
- All messages over the boundary carry a `type` discriminator; the pool routes on the task-resolve / task-reject / run-task message types. New cross-boundary messages must follow this tagged shape.
- The runtime's own timeout is disabled; the pool owns timeouts by killing the child. The runtime's module whitelist is the security boundary for what a job may import — regexes are stringified to cross the boundary and rehydrated in the thread.
- Outgoing thread payloads are size-checked and oversized fields (state, logs) are redacted, not truncated transparently. Don't assume an emitted event carries the full state.

## Gotchas
- Run the engine via the async factory and await it — it validates a live worker (handshake) before accepting work; a bad/missing worker file fails here, not at execute time.
- Autoinstall and credential preloading happen on the MAIN thread before the task is dispatched; compilation happens INSIDE the thread. Don't move install/network work into the thread or expect lazy credential loading.
- A clean worker exit uses a sentinel exit code; any other exit code is treated as a crash. OOM is detected by scraping the child's stderr for the V8 heap message — fragile, and distinct from the timeout path (which kills the child proactively).
- Pool has fixed capacity; tasks beyond capacity queue rather than spawning unbounded children. Children are reused (returned to pool) unless killed by crash/OOM/timeout, so don't rely on fresh global state per run at the child level — isolation comes from the per-run thread, not the child.
- Consumers get a per-workflow emitter; events are proxied main<-child<-thread. `listen()` can be called before `execute()` (handlers are deferred), and execute is dispatched on a tick so listeners can attach first. ws-worker's event processor consumes these.
- `console.log` inside the thread is hijacked into the adaptor logger and won't reach stdout; use `console.debug` for raw stdout debugging.

## Testing
- Tests run against `dist/` (worker entrypoints are resolved as built files, e.g. `dist/worker/...`, `dist/test/...`). Run `pnpm build` before `pnpm test` or paths won't resolve.
- ava runs `--serial` (process/pool tests are stateful). Mock workers/runners exist as separate tsup entries (mock-run, worker-functions) — pass a custom worker path into the engine/pool to use them instead of the real runtime.
