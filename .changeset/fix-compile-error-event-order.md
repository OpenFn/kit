---
'@openfn/engine-multi': patch
---

Emit compilation failure log before workflow-error event. Previously the error
event arrived first, causing the ws-worker to tear down the channel before the
log could be delivered.
