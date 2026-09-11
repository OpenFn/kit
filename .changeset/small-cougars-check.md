---
'@openfn/project': patch
---

- Fix an issue where removing a workflow triggers an error on merge
- Allow Workflows to track deleted entities internally via the `removed` index
- Recognise `delete` state on workflows, steps and edges when parsing from/to app state
