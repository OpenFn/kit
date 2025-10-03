---
'@openfn/compiler': patch
---

Improved log output:

- Don't log anything for import/export statements (consistent with other visitors)
- When a step is compiled, include the step name
