---
'@openfn/project': patch
'@openfn/cli': patch
---

Channels are now tracked by their Lightning id, so changing a channel's key in resources.yaml no longer deletes and recreates it on deploy.
