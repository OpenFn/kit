---
'@openfn/ws-worker': minor
---

Implement per-group workloops and queue-aware claiming. Each slot group now gets its own independent workloop, tracks its own active runs and capacity, and sends queue-scoped claims to Lightning. The join payload now includes a queues map so Lightning knows the slot distribution. Default behavior (no `--workloops`) is preserved with a single `manual>*` group.
