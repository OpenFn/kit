---
'@openfn/cli': patch
---

Resolved an issue where the `-p` (project path) flag was ignored in the `deploy` command, causing the CLI to default to `project.yaml` instead of the specified file.
