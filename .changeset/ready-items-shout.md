---
'@openfn/engine-multi': minor
'@openfn/ws-worker': minor
'@openfn/runtime': minor
---

Measure the size of state objects at the end of each step, and throw if they exceed a limit

In the Worker, this limit is set to 25% of the available runtime memory.
