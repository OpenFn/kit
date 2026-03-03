---
'@openfn/ws-worker': patch
---

Update the batch logs API.

Previously if running with `--batch-logs` enabled, the Worker would restructure the `run:log` event to send a { logs: [] } array on the payload. This functionality was never released to lightning so should be unused.

Batch logs are now configured to send a separate `run:batch_logs` event, preserving the `run:log` payload.

Batch logs will remain disabled by default until the next major release.
