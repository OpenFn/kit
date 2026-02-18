---
'@openfn/project': minor
'@openfn/cli': minor
---

Update credentials to use credential id, not UUID. This enables credentials to sync better with app projects.

WARNING: existing credential maps will break after pulling after this change. Update your credential maps to index on the new id values rather than the UUIDs.
