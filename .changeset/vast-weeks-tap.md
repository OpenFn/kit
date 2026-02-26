---
'@openfn/cli': minor
---

Support github sync with new `project` commands

GitHub Sync is currently designed with a pair of actions which trigger the legacy `openfn deploy` and `openfn pull` commands.

This update adds support for the `openfn.yaml` file to the commands: so if you run `openfn project pull` in a github synced repo, the repo goes into v2 mode. The legacy deploy and pull commands will "redirect" to v2. You should leave the legacy `config.json` file, but state.json and spec.yaml files can be removed.

Initaliasing GitHub sync from the app will continue to use the legacy file structure for the initial commit. If you want to switch to v2, either create an empty openfn.yaml and trigger a sync, or locally run `openfn project pull` and commit changes.

Be aware that v2 sync only supports a single `openfn.yaml` and `workflows` folder at a time - so a sync which pulls from multiple connected apps will not work well. It should however be safe to push changes to multiple apps.
