---
'@openfn/ws-worker': patch
---

When processing final state for a run with multiple leaf nodes, don't send empty leaf results. This prevents state recursively growing in cron tasks
