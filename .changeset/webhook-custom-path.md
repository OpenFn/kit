---
'@openfn/deploy': minor
---

Carry a webhook trigger's `custom_path` through deploy, so an endpoint can be named in `project.yaml` and its URL is known before deploying.

A path only travels when the spec mentions it. Leaving the key out means the server keeps whatever it has, so deploying a spec written before this existed will not wipe a path set in the app. Writing it blank, either as `''` or as a bare `custom_path:`, clears it.
