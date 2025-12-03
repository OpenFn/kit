---
'@openfn/cli': minor
---

Refactor of openfn project command. There are very few user-facing changes, and they should be compatible

- A new `project` namespace has been set up, allowing `openfn project version|list|merge|checkout`
- `openfn projects` will continue to list projects in the workspace (but is just an alias of list)
- The prior `openfn merge|checkout` command still exist, it just aliases to `openfn projct merge|checkout`

One change to watch out for is that `--project-path` has been changed to `--workspace`, which can also be set through `-w` and `OPENFN_WORKSPACE`.
