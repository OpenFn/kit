---
'@openfn/project': minor
'@openfn/cli': patch
---

Workflow, step and channel ids now keep non-ASCII letters and punctuation from their names, matching Lightning. Names with these characters get new ids, so their folders and resources.yaml keys change on the next pull.
