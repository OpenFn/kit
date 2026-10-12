---
'@openfn/project': minor
---

Add `findWorkflow()` for fuzzy workflow lookups and make `getWorkflow()` match by id only.

To migrate, replace `getWorkflow(nameOrUuid)` with `findWorkflow(nameOrUuid)`, which throws if more than one workflow matches.
