---
'@openfn/ws-worker': patch
---

Retry events if they are timed out. Will retry TIMEOUT_RETRY_COUNT times and wait for TIMEOUT_RETRY_DELAY or WORKER_MESSAGE_TIMEOUT_SECONDS between retries
