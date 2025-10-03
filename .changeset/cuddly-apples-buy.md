---
'@openfn/ws-worker': patch
---

Allow the worker to shutdown gracefully while claims are still in-flight. Runs will be completed before the server closes
