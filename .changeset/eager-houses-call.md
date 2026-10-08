---
'@openfn/project': minor
'@openfn/cli': minor
---

Restructure `openfn.yaml` to make it safer for merging on github.

Any checkout state (basically anything under the project key) have been moved into a new `.openfn` folder, which should not be tracked.

`openfn.yaml` now just contains workspace-wide configuration.
