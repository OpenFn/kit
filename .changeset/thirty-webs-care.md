---
'@openfn/ws-worker': patch
---

Retry events if they are timed out. Will retry WORKER_TIMEOUT_RETRY_COUNT times and wait for WORKER_TIMEOUT_RETRY_DELAY_MS or WORKER_MESSAGE_TIMEOUT_SECONDS between retries
