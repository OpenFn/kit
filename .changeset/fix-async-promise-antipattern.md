---
'@openfn/ws-worker': patch
---

Fix `new Promise(async ...)` antipattern in run-log.ts, try-with-backoff.ts,
and destroy.ts. Errors thrown inside the async executor became unhandled
rejections instead of propagating to the caller. This was the direct cause of
a production worker crash where a LightningTimeoutError on run:log killed the
container.
