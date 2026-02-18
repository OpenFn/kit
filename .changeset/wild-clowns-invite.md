---
'@openfn/project': minor
'@openfn/cli': minor
---

Update credentials to use credential id, not UUID

WARNING: existing credential maps will break after pulling after this change. Update your credential maps to index on the new id values rather than the UUIDs.
