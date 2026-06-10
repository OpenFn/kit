# Runtime (@openfn/runtime)
Executes a compiled workflow (execution plan) by running each job's operation array in series inside a sandboxed VM, returning serializable final state.

## Invariants
- The runtime does NOT compile, install, or do disk I/O. It receives already-compiled job code (an array of operations). Don't add compilation, auto-install, or filesystem side effects here — those belong to the runtime manager (CLI/worker).
- Jobs are loaded as ESM strings via `vm.SourceTextModule`; a job must export a default array of functions, each `(state) => state`. Non-array/non-function exports throw validation errors.
- Sandbox boundary: each job runs in a `vm.createContext` with code generation disabled (no `eval`/`new Function`/wasm). Only an explicit, frozen set of globals is exposed. Don't widen what's injected casually, and don't assume Node globals are present inside the sandbox.
- State must be serializable. State is deep-cloned (via safe stringify) at job boundaries, so non-JSON values (functions, circular refs handled but dropped) won't survive between jobs. Final returned state is cloned again.
- Module isolation in long-lived processes depends on the linker `cacheKey`: same key caches a module across jobs in one workflow, a unique key isolates workflows. Keep all jobs in one run on the same key; never share a key across runs. Caching leaks memory by design — the manager is responsible for reclaiming it.

## Gotchas
- Immutability between operations is only enforced when the `immutableState` option is set (it clones before each op); otherwise operations mutate state in place. Don't assume inputs are frozen in operation-level code.
- The injected globals are `Object.freeze`d — except the legacy `state` global, which is deliberately left mutable and is being phased out. Don't rely on or extend it.
- `Buffer` is replaced inside the sandbox: the constructor throws by design (use `Buffer.from`). Internal runtime code must use the real Node Buffer.
- Error handling has a severity model: `fail` errors are written to state and the workflow continues down its edges; `crash`/`kill` abort the whole run. Errors are classified by inspecting stack frames (adaptor vs VM vs runtime) and JS error type — fragile string matching, so changes to error wrapping/naming can silently reclassify errors.
- Requires the parent process to run with `--experimental-vm-modules`; without it module loading fails. Callers (CLI, engine-multi worker) pass this flag.
- The linker whitelist is an array of regexes; string entries are parsed to regex at the entry point. `@openfn/runtime` itself is import-whitelisted for direct loading.

## Testing
- Tests run against this package's `src/` via `@swc-node/register` (ava) — no build of runtime needed. (Cross-package `@openfn/*` deps still resolve to their built `dist/`.)
- The ava run must include `--experimental-vm-modules` (set in the shared config); the memory test uses a separate config that exposes gc and disables worker threads, and is excluded from the default run.
- Fixtures: `test/__modules__` holds sample job/module sources and `test/__repo__` is a fake module repo for exercising the linker. Reuse these rather than mocking module loading inline.
