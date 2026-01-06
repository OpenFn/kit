---
'@openfn/runtime': minor
---

Support special condition strings `never`, `always`, `on_job_success` and `on_job_fail`.

These used to be mapped from Lightning workflows by the Worker, but by supporting them in the runtime directly we get much better compatibility across platforms
