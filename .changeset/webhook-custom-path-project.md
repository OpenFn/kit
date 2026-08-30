---
'@openfn/project': minor
'@openfn/lexicon': patch
---

Hash a webhook trigger's `custom_path` in the workflow version, so a workflow whose only change is its endpoint name is no longer reported as unchanged. Lightning hashes the same key, so the two stay in step. A workflow without a path, and a stale path on a cron or kafka trigger, hash exactly as before.

Keep `custom_path` as a top-level key when reading a project from app state, rather than sweeping it under `openfn:`.
