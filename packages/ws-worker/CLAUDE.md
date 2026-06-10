# Worker (@openfn/ws-worker)

Stateless websocket bridge: claims runs from Lightning's queue, runs them via engine-multi, and streams results back over per-run Phoenix channels.

## Invariants

- Zero persistence. Lightning is the source of truth; the worker keeps no DB and no filesystem state. Any in-flight tracking is lost on crash, and Lightning is responsible for timing those runs out. Never add code that assumes the worker can recover state after a restart.
- Engine events reach Lightning strictly in emission order, one at a time, each awaiting websocket acknowledgement before the next is sent. This is the central guarantee — Lightning cannot reconstruct order from timestamps (clock skew). The event processor (`api/process-events.ts`) enqueues every engine event and drains the queue sequentially; do not introduce parallel sends or skip the queue. Deep dive: [.claude/event-processor.md](../../.claude/event-processor.md).
- Engine event names (`workflow-start`, `job-*`, `workflow-log`, etc., from engine-multi) are mapped to Lightning channel events (`run:*`, `step:*`) inside the processor. Keep that mapping the single source of truth; events without a mapping fall through under their engine name.
- Each run executes inside its own Sentry isolation scope and its own `run:<id>` channel; channel auth is per-run via a token, the queue socket auths via WORKER_SECRET. Don't share channels across runs.
- Continue-on-error: a failing event handler is reported (once) to Sentry and dropped, then processing continues. A failed event must never halt the rest of the run's event stream.

## Gotchas

- `send-event.ts` resolves on `ok`, rejects on `error`/`timeout`. Retry-on-timeout is deliberately disabled (it caused duplication on Lightning) — leave it off unless you also move retry logic into the event processor.
- Log batching is opt-in (`batchLogs`) and currently applies only to log events. A batch closes on size limit, batch-interval timeout, or arrival of a different event type; the processor peeks ahead in the queue to pack the batch. Batching has its own concurrent async path guarded carefully — be very cautious editing the batch open/close/peek logic, it is easy to create two competing drain loops.
- `run-start` deliberately sends its version/limit log lines synchronously (awaited, bypassing the queue order trick) and back-dates their timestamps so they sort first in Lightning's log.
- `onJobError` maps a job error to a step-complete (fail) vs a genuine crash by comparing the error against what was written to state — fragile by design; understand it before touching.
- `--workloops` / `--capacity` are mutually exclusive; total capacity is the sum of all workloop group slots, and one shared engine backs all lanes.

## Testing

- The worker's own code is tested against `src/` via `@swc-node/register` (no build needed for it). But many tests spin up a real `engine-multi`, which runs its workers from `dist/` — so run `pnpm build` first, or those tests fail confusingly.
- Tests use `@openfn/lightning-mock` (a real mock Lightning server) and/or the in-package mock engine (`src/mock/`) and mock sockets. Integration-style tests (e.g. `lightning.test.ts`) spin up the mock server; lower-level tests use a real engine-multi instance with a fake channel.
- Run serially (`--serial`); tests stand up real servers/sockets, so avoid shared ports/state between tests.
