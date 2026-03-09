---
'@openfn/ws-worker': minor
'@openfn/lexicon': patch
---

Add `--queues` CLI option for slot group configuration, enabling dedicated worker capacity for named queues (e.g., `--queues "fast_lane:1 manual,*:4"`). Mutually exclusive with `--capacity`. Also adds `queues` field to `ClaimPayload` type.
