---
'@openfn/compiler': minor
'@openfn/lexicon': minor
'@openfn/project': minor
'@openfn/cli': minor
---

Improve `openfn compile` for unit-testing job code

- Add `--exports-only` to strip adaptor operation calls, keeping only exported declarations
- Compile whole projects (or a single workflow by name) to `dist/` as `.mjs` files
- Add `--clean` to remove the output folder before compiling
- Add `--workspace` support (as in `openfn execute` and `openfn project`)
- Support a `dirs.compiled` key in the workspace config (openfn.yaml) to set the output folder
- Watch mode now respects the configured workflows and output directories
