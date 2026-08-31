---
'@openfn/deploy': minor
---

Carry a webhook trigger's `custom_path` through deploy, so an endpoint can be named in `project.yaml` and its URL is known before deploying.

A path only travels when the spec mentions it. Leaving the key out means the server keeps whatever it has, so deploying a spec written before this existed will not wipe a path set in the app. Writing it blank, either as `''` or as a bare `custom_path:`, clears it.

`deploy` also stops reporting a removal for trigger fields the payload does not carry, since absence means "leave this alone". It still shows the full diff when a trigger is being deleted, or when its type or reply mode is changing, because the server clears fields by resolved type and an absent key stops meaning "leave alone" then.
