---
'@openfn/runtime': minor
---

Use async serialization on state objects at the end of each step.

This may result in slightly different handling of state objects at the end of each step. It should add stability by making sure that huge state objects throw a graceful OOMKill, rather than blowing up the wrapping worker.
