---
'@openfn/project': patch
'@openfn/lexicon': patch
---

Keep a webhook trigger's `custom_path` as a top-level key when reading a project from app state, rather than sweeping it under `openfn:`.
