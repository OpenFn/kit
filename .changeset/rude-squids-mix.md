---
'@openfn/ws-worker': patch
---

Count outstanding claim requests as capacity. This fixes an issue where `work-available` messages can cause a worker to over-claim, particularly during periods of high load on the Lightning database.
