# @openfn/cli

## 1.29.1

### Patch Changes

- Fix an issue when doing an initial pull with GH sync and an openfn.yaml file, where the endpoint in config.json should be used to intiate the sync

## 1.29.0

### Minor Changes

- 2d570c6: Support github sync with new `project` commands

  GitHub Sync is currently designed with a pair of actions which trigger the legacy `openfn deploy` and `openfn pull` commands.

  This update adds support for the `openfn.yaml` file to the commands: so if you run `openfn project pull` in a github synced repo, the repo goes into v2 mode. The legacy deploy and pull commands will "redirect" to v2. You should leave the legacy `config.json` file, but state.json and spec.yaml files can be removed.

  Initaliasing GitHub sync from the app will continue to use the legacy file structure for the initial commit. If you want to switch to v2, either create an empty openfn.yaml and trigger a sync, or locally run `openfn project pull` and commit changes.

  Be aware that v2 sync only supports a single `openfn.yaml` and `workflows` folder at a time - so a sync which pulls from multiple connected apps will not work well. It should however be safe to push changes to multiple apps.

### Patch Changes

- cbe2800: Improve --help docs and error messages
- Updated dependencies [cbe2800]
  - @openfn/project@0.14.2

## 1.28.2

### Patch Changes

- `project deploy`: Fix an issue where the version history returned by the Provisioner can be incorrect, resulting in constant incorrect divergence warnings

## 1.28.1

### Patch Changes

- 58a9919: Fix an issue where added and removed workflows are ignored by merge
- 66e7c13: Fix deploy when the target project is a different UUID to the local project
- Updated dependencies [58a9919]
  - @openfn/project@0.14.1

## 1.28.0

### Minor Changes

- 1bbc8c4: Update credentials to use credential id, not UUID. This enables credentials to sync better with app projects.

  WARNING: existing credential maps will break after pulling after this change. Update your credential maps to index on the new id values rather than the UUIDs.

### Patch Changes

- Updated dependencies [1bbc8c4]
  - @openfn/project@0.14.0

## 1.27.0

### Minor Changes

- 92c0b49: In `project deploy`, allow new projects to be created if `--new` is passed. Add `--name my-project` to override the name in the newly created project

### Patch Changes

- 5d6237d: Default endpoint to app.openfn.org and improve error message
- Updated dependencies [92c0b49]
- Updated dependencies [dd88099]
  - @openfn/project@0.13.1
  - @openfn/runtime@1.8.4

## 1.26.0

Overhaul `project deploy` for better conflict detection and more stable uploads, with more accurate warnings and less loss of data

### Minor Changes

- When fetching a sandbox, default the alias to the sandbox id
- When checking out a project, warn if local changes could be lost
- Update version hash to match Lightning
- Better conflict detection on `project pull` and `project push`
- 4f3830e: Add `push` as an alias for `deploy` (v2)

### Patch Changes

- Updated dependencies [5771665]
  - @openfn/project@0.12.2

## 1.25.0

### Minor Changes

- 8b9f402: fetch: allow state files to be written to JSON with --format

### Patch Changes

- 26381fa: Fix an issue where start is not correctly loaded from workflow.yaml
- 5a575eb: On deploy, skip the check to see if the remote history has diverged. History tracking still needs some work and this feature isn't working properly yet"
- 8c55995: When checking out new projects, only delete the files necessary
- 090fbf3: Fix step caching when running a workflow through the Project
- Updated dependencies [090fbf3]
- Updated dependencies [f2856c5]
- Updated dependencies [a23e4e7]
- Updated dependencies [8c55995]
  - @openfn/project@0.12.1
  - @openfn/runtime@1.8.3

## 1.24.1

### Patch Changes

- Updated dependencies [61d9418]
  - @openfn/runtime@1.8.2

## 1.24.0

### Minor Changes

- Total rewrite of project deploy (aka deploy --beta)

  ```
  openfn deploy
  ```

  This will deploy your currently checked out project to the synced app.

  Recommend passing `--log debug` to get richer output of what's happening.

  It will prompt for confirmation before posting.

  This new function appears stable but is currently undergoing testing. Use with caution.

### Patch Changes

- Updated dependencies [e33e362]
- Updated dependencies [ef06f98]
- Updated dependencies [1b5e837]
  - @openfn/lexicon@1.4.0
  - @openfn/project@0.12.0

## 1.23.0

### Minor Changes

- projects: when pulling, include a `start` option which points to the trigger, ensuring workflow.yaml files start executing from the right place.
- projects: When running `execute` inside a Workspace (a folder with an `openfn.yaml` file), allow Workflows to be run directly. I.e. do this:

  ```bash
  openfn process-patients
  ```

  Instead of:

  ```
  openfn ./workflows/process-patients/process-patients.yaml
  ```

  When running through a Workspace, credential maps and collections endpoints are automatically applied for you.

### Patch Changes

- b262d10: projects: Support workflow.jaml/json files without a top workflow key
- d1a0e7c: When executing jobs, the CLI no longer defaults the path to job.js
- Updated dependencies [b262d10]
- Updated dependencies [147a431]
- Updated dependencies [d1a0e7c]
  - @openfn/runtime@1.8.1
  - @openfn/project@0.11.0

## 1.22.0

### Minor Changes

- f089f8d: Fix edge conditions in pulled workflows

### Patch Changes

- Updated dependencies [f089f8d]
- Updated dependencies [f089f8d]
- Updated dependencies [064933d]
  - @openfn/runtime@1.8.0
  - @openfn/project@0.10.1

## 1.21.0

### Minor Changes

- 6689ad0: Add support for aliases on all project subcommands (ie, `openfn project fetch --staging && openfn project checkout staging`)
- 3e63c08: Allow credential map, as json or yaml, to be passed via --credentials
- 6689ad0: Full native support for Collections (no need to manually set `adaptors` key to an array)

### Patch Changes

- 4cc799b: Refactor pull into a project command
- Updated dependencies [4cc799b]
  - @openfn/project@0.10.0

## 1.20.3

### Patch Changes

- a030ebd: Fix an issue where error positions are not properly reported for named steps in a workflow
- Updated dependencies [a1bfdc1]
- Updated dependencies [c70369b]
  - @openfn/runtime@1.7.7
  - @openfn/logger@1.1.1
  - @openfn/compiler@1.2.2
  - @openfn/deploy@0.11.5
  - @openfn/project@0.9.3

## 1.20.2

### Patch Changes

- 6766d96: Fixed an issue where credentials can get dropped in `deploy --beta`
- Updated dependencies [6766d96]
  - @openfn/project@0.9.2

## 1.20.1

### Patch Changes

- ff42d44: Support `endpoint` argument in collections command

## 1.20.0

### Minor Changes

- 69ec22a: Refactor of openfn project command. There are very few user-facing changes, and they should be compatible

  - A new `project` namespace has been set up, allowing `openfn project version|list|merge|checkout`
  - `openfn projects` will continue to list projects in the workspace (but is just an alias of list)
  - The prior `openfn merge|checkout` command still exist, it just aliases to `openfn projct merge|checkout`

  One change to watch out for is that `--project-path` has been changed to `--workspace`, which can also be set through `-w` and `OPENFN_WORKSPACE`.

- 162e0ea: Add a fetch command, which will download a project from an app but not check it out. This will throw if the local project version has diverged from the remote version.

  Rebased `pull --beta` to simply be fetch & checkout

## 1.19.0

### Minor Changes

- 72f18b1: In pull --beta, use an improved and updated structure for project.yaml files
- 9001244: Support .env files in all CLI commands

### Patch Changes

- Updated dependencies [72f18b1]
- Updated dependencies [2cc28a6]
  - @openfn/lexicon@1.2.7
  - @openfn/project@0.9.1
  - @openfn/logger@1.1.0
  - @openfn/compiler@1.2.1
  - @openfn/deploy@0.11.4
  - @openfn/runtime@1.7.6

## 1.18.6

### Patch Changes

- Updated dependencies [6bd4210]
  - @openfn/compiler@1.2.0

## 1.18.5

### Patch Changes

- Updated dependencies [e93ec75]
- Updated dependencies [5630eca]
  - @openfn/project@0.9.0

## 1.18.4

### Patch Changes

- Updated dependencies [e427771]
  - @openfn/project@0.8.0

## 1.18.3

### Patch Changes

- 75e3220: support --output in merge, to write the merged project file elsewhere. Useful for backups, merge conflicts and testing
- 43b0b0c: checkout: fixed issues when using custom file paths
- Updated dependencies
- Updated dependencies [88f7f80]
- Updated dependencies [435d55c]
- Updated dependencies [64b6d4a]
  - @openfn/lexicon@1.2.6
  - @openfn/project@0.7.2

## 1.18.2

### Patch Changes

- Updated dependencies [fe06f44]
  - @openfn/runtime@1.7.5

## 1.18.1

### Patch Changes

- Updated dependencies [3cd3cd5]
  - @openfn/runtime@1.7.4

## 1.18.0

### Minor Changes

- 16da2ef: Warn when merging two projects might result in lost work

### Patch Changes

- Updated dependencies [16da2ef]
- Updated dependencies [16da2ef]
  - @openfn/project@0.7.0

## 1.17.2

### Patch Changes

- edfc759: Update Project dependency
- 6a68759: Respect openfn.yaml options in pull --beta
- f4209dd: Warn when merging projects which may have diverged
- Updated dependencies [f955548]
- Updated dependencies [edfc759]
- Updated dependencies [329d29d]
  - @openfn/project@0.6.1

## 1.17.1

### Patch Changes

- a0a1cb7: Add log option for checkout and merge

## 1.17.0

### Minor Changes

- New command: openfn project version

### Patch Changes

- Updated dependencies
  - @openfn/project@0.6.0

## 1.16.2

### Patch Changes

- 8a50703: Allow a project to be checked out from a direct path to a project file
- 7d16875: When merging, allow the source project to specified as a path to a project file
- Updated dependencies [81b97c3]
- Updated dependencies [43be979]
- Updated dependencies [1f8d65e]
- Updated dependencies [25c7a2b]
- Updated dependencies [04a89e2]
- Updated dependencies [7d16875]
  - @openfn/project@0.5.1
  - @openfn/lexicon@1.2.4

## 1.16.1

### Patch Changes

- Updated dependencies [cb97744]
- Updated dependencies [49caf75]
  - @openfn/compiler@1.1.5
  - @openfn/project@0.5.0

## 1.16.0

### Minor Changes

- Support merge command, to merge two projects while preserving UUIDs

### Patch Changes

- Updated dependencies
  - @openfn/project@0.4.1

## 1.15.1

### Patch Changes

- Updated dependencies [362d6bf]
  - @openfn/compiler@1.1.4

## 1.15.0

### Minor Changes

- 8af8c15: Add a checkout command to allow switching between openfn projects in a workspace.

### Patch Changes

- 64d0cea: Fix CLI execution errors when passed a workflow yaml file.
- Updated dependencies [2315417]
- Updated dependencies [b0306c1]
- Updated dependencies [14b0b58]
  - @openfn/compiler@1.1.3
  - @openfn/project@0.4.0

## 1.14.1

### Patch Changes

- ca3d6ca: Fix an issue pulling projects with pull --beta
- Updated dependencies [ca3d6ca]
  - @openfn/project@0.3.1

## 1.14.0

### Minor Changes

- 7ae519b: Add `openfn projects` command

### Patch Changes

- Updated dependencies [7ae519b]
  - @openfn/project@0.3.0

## 1.13.6

### Patch Changes

- Updated dependencies [1a3caea]
  - @openfn/compiler@1.1.2

## 1.13.5

### Patch Changes

- Updated dependencies
  - @openfn/project@0.2.0

## 1.13.4

### Patch Changes

- Update dependencies
- Updated dependencies
  - @openfn/describe-package@0.1.5
  - @openfn/compiler@1.1.1
  - @openfn/lexicon@1.2.3
  - @openfn/project@0.1.1
  - @openfn/runtime@1.7.2
  - @openfn/deploy@0.11.3
  - @openfn/logger@1.0.6

## 1.13.3

### Patch Changes

- 284b889: apollo: add support for events while streaming from apollo

## 1.13.2

### Patch Changes

- ba70253: Lock undici to v7.12 to retain compatibility with node18

## 1.13.1

### Patch Changes

- 6ec2c48: Better cache management in the metadata command
- Updated dependencies [f04acef]
  - @openfn/runtime@1.7.1

## 1.13.0

### Minor Changes

- 9d4ece3: Add support for global functions in execution plan

### Patch Changes

- Updated dependencies [9d4ece3]
  - @openfn/compiler@1.1.0
  - @openfn/runtime@1.7.0

## 1.12.1

### Patch Changes

- Updated dependencies [79686ce]
  - @openfn/deploy@0.11.2

## 1.12.0

### Minor Changes

- Add --beta flag to pull and deploy commands, which use new `projects` for better local project management. See https://github.com/OpenFn/kit/wiki/Pull-Deploy-Beta

  New projects downloaded with beta are fully compatible with cli execute

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @openfn/lexicon@1.2.2
  - @openfn/project@0.2.0
  - @openfn/compiler@1.0.4
  - @openfn/runtime@1.6.4

## 1.11.5

### Patch Changes

- Updated dependencies
  - @openfn/lexicon@1.2.1
  - @openfn/compiler@1.0.3
  - @openfn/runtime@1.6.4

## 1.11.4

### Patch Changes

- Updated dependencies [0a176aa]
  - @openfn/logger@1.0.5
  - @openfn/compiler@1.0.2
  - @openfn/deploy@0.11.1
  - @openfn/lexicon@1.2.0
  - @openfn/runtime@1.6.4

## 1.11.3

### Patch Changes

- 2667710: Fix an issue where step completion time is logged with double units (ie, `2msms`)
- Updated dependencies [2667710]
  - @openfn/runtime@1.6.3

## 1.11.2

### Patch Changes

- Updated dependencies

## 1.11.1

### Patch Changes

- Added lexicon as a runtime dependency for typings
- Updated dependencies [beb4617]
  - @openfn/runtime@1.6.2

## 1.11.0

### Minor Changes

- 706124a: deploy: Print helpful error messages when an invalid spec is encountered

### Patch Changes

- Updated dependencies [706124a]
  - @openfn/deploy@0.11.0

## 1.10.4

### Patch Changes

- 295ceed: CLI Deploy: Don't send empty collections
- Updated dependencies [295ceed]
  - @openfn/deploy@0.10.0

## 1.10.3

### Patch Changes

- Updated dependencies [6363e4a]
  - @openfn/deploy@0.9.0

## 1.10.2

### Patch Changes

- Properly resolve adaptor versions when they are explicitly set to @latest

## 1.10.1

### Patch Changes

- 70e3d7a: Fix error reporting when loading adaptors from the monorepo
- Updated dependencies [70e3d7a]
  - @openfn/runtime@1.6.1

## 1.10.0

### Minor Changes

- Overhaul of error reporting in the CLI. Errors now include positional information and a stack trace, and reporting has generally been cleaned up a little bit.

### Patch Changes

- Updated dependencies [4ddd4d6]
- Updated dependencies [93e9844]
- Updated dependencies [6e87156]
- Updated dependencies [aaa7e7b]
- Updated dependencies [4ddd4d6]
  - @openfn/runtime@1.6.0
  - @openfn/compiler@1.0.0
  - @openfn/logger@1.0.4
  - @openfn/deploy@0.8.2

## 1.9.1

### Patch Changes

- Ensure support for node 18,20 and 22.

  This update ensures compatibility with node 18 LTS, 20 LTS, and 22.12.

  Most of the changes are in the build and test suites and have only minor impact on production code. No issues are anticipated as as result of this change.

  Prior releases may fail on node version >=20.

  Support for node 18 will be removed in late 2025.

- Updated dependencies
- Updated dependencies [8904af2]
  - @openfn/describe-package@0.1.4
  - @openfn/compiler@0.4.3
  - @openfn/runtime@1.5.4
  - @openfn/deploy@0.8.1
  - @openfn/logger@1.0.3

## 1.9.0

### Minor Changes

- 3a95d3b: Add collections command

### Patch Changes

- 03f5b40: Adjust OPENFN_REPO_DIR warning message

## 1.8.12

### Patch Changes

- When using lazy state in job code, allow functions to be called directly on the state object, ie, `$.generateUUID()`
- Updated dependencies
  - @openfn/compiler@0.4.2

## 1.8.11

### Patch Changes

- Updated dependencies [ddda182]
  - @openfn/describe-package@0.1.3
  - @openfn/compiler@0.4.1

## 1.8.10

### Patch Changes

- Warn when an expression doesn't return state
- Updated dependencies [1cbbba0]
  - @openfn/runtime@1.5.3

## 1.8.9

### Patch Changes

- Updated dependencies [f6bd593]
  - @openfn/runtime@1.5.2

## 1.8.8

### Patch Changes

- 1f13d8f: Resolved an issue where the `-p` (project path) flag was ignored in the `deploy` command, causing the CLI to default to `project.yaml` instead of the specified file.

## 1.8.7

### Patch Changes

- eeb660d: Fix an issue from previous patch where initial state.configuration could be lost at the start of a step
- Updated dependencies [eeb660d]
  - @openfn/runtime@1.5.1

## 1.8.6

### Patch Changes

- 528e9a0: Support multiple adaptors
- Updated dependencies [3463ff9]
- Updated dependencies [7a85894]
- Updated dependencies [b6de2c4]
  - @openfn/runtime@1.5.0
  - @openfn/compiler@0.4.0

## 1.8.5

### Patch Changes

Support Kafka trigger type in CLI

- Updated dependencies [7c96d79]
  - @openfn/deploy@0.8.0

## 1.8.4

### Patch Changes

- 5db5862: Dont log compiled job code
- Updated dependencies [5db5862]
  - @openfn/compiler@0.3.3

## 1.8.3

### Patch Changes

Security update.

- Updated dependencies [423a927]
  - @openfn/describe-package@0.1.2
  - @openfn/compiler@0.3.2

## 1.8.2

### Patch Changes

Security updates

## 1.8.1

### Patch Changes

- Updated dependencies [0d53f9b]
  - @openfn/deploy@0.7.0

## 1.8.0

### Minor Changes

- b7fc4d0: Deploy: allow job body to be loaded from a file path in workflow.yaml

### Patch Changes

- Updated dependencies [b7fc4d0]
  - @openfn/deploy@0.6.0

## 1.7.1

### Patch Changes

- 2f5dc51: Update the compiler to treat method calls (http.get()) like operations
- Updated dependencies [4751c90]
  - @openfn/compiler@0.3.0

## 1.7.0

### Minor Changes

- Allow operations to behave like promises (ie, support fn().then())

### Patch Changes

- Updated dependencies [40fd45b]
- Updated dependencies [40fd45b]
  - @openfn/compiler@0.2.0
  - @openfn/runtime@1.4.1

## 1.6.1

### Patch Changes

- 505d60b: Add snapshot ids to the url for fetching project spec

## 1.6.0

### Minor Changes

- 960f293: Add snapshots option to cli pull command

### Patch Changes

- Updated dependencies [960f293]
  - @openfn/deploy@0.5.0

## 1.5.0

### Minor Changes

- Better error reporting in logs and on final state

### Patch Changes

- Updated dependencies [afcd041]
  - @openfn/runtime@1.4.0

## 1.4.2

### Patch Changes

- Updated dependencies [6d01592]
  - @openfn/describe-package@0.1.0
  - @openfn/compiler@0.1.4

## 1.4.1

### Patch Changes

- Updated dependencies [fa65a0f]
  - @openfn/describe-package@0.0.20
  - @openfn/compiler@0.1.3

## 1.4.0

### Minor Changes

- 736935a: Allow state in a workflow to be a path
- e8fc192: Add support for @next and @latest tags in adaptor versions

### Patch Changes

- Updated dependencies [e8fc192]
- Updated dependencies [e8fc192]
  - @openfn/runtime@1.3.0

## 1.3.3

### Patch Changes

- 86119ea: Better error messages in deploy
  Support env vars on pull
- Updated dependencies [86119ea]
  - @openfn/deploy@0.4.7

## 1.3.2

### Patch Changes

- Enable a step to have multiple inputs
- Updated dependencies
  - @openfn/runtime@1.2.0

## 1.3.1

### Patch Changes

- Validate workflow.json before executing to catch common errors

## 1.3.0

### Minor Changes

- 015055c: Add first pass of apollo command. Call an apollo service with `openfn apollo <service-name>`. For basic help run `openfn apollo --help`. For available services see the server index page. This first release is a super basic integration with log streaming through websockets and reasonably intelligent handling of `{ files }` result data.

## 1.2.6

### Patch Changes

- deploy: Improved error messages from local validation

## 1.2.5

### Patch Changes

- Default the run timeout
- Updated dependencies
  - @openfn/runtime@1.1.3

## 1.2.4

### Patch Changes

- deploy: Allow steps in different workflows to have the same name

## 1.2.3

### Patch Changes

- 1dffdfc: support autoinstall in the metadata command

## 1.2.2

### Patch Changes

- Updated dependencies [adfb661]
  - @openfn/deploy@0.4.5

## 1.2.1

### Patch Changes

- Fix --end and --only

## 1.2.0

### Minor Changes

- ea248a3: Allow step output to be cached
  Accept fuzzy step ids in `--start`, `--end` and `--only`

### Patch Changes

- 7ddc5d8: Support expressions in lazy state operators
- 4deb5d4: Recognise import aliases in job code
- Updated dependencies [cecdb60]
- Updated dependencies [4deb5d4]
- Updated dependencies [7ddc5d8]
  - @openfn/runtime@1.1.2
  - @openfn/describe-package@0.0.19
  - @openfn/compiler@0.1.2

## 1.1.4

### Patch Changes

- Updated dependencies
  - @openfn/compiler@0.1.1

## 1.1.3

### Patch Changes

- Updated dependencies [6dcce3d]
- Updated dependencies [1d37ca1]
  - @openfn/compiler@0.1.0

## 1.1.2

### Patch Changes

- Fix pull with empty workflows
- Added debug logging for workflow loading
- Better docs output
- Fix execute example in help

## 1.1.1

### Patch Changes

- Updated dependencies [2fde0ad]
  - @openfn/logger@1.0.1
  - @openfn/compiler@0.0.41
  - @openfn/deploy@0.4.3
  - @openfn/runtime@1.0.1

## 1.1.0

### Patch Changes

Allow multiple version of the same adaptor to run in the same workflow

- Updated dependencies [4f5f1dd]
  - @openfn/runtime@1.1.0

## 1.0.0

### Major Changes

- 86dd668: The 1.0 Release of the CLI updates the language and input of the CLI to match the nomenclature of Lightning.

  See the readme for details of the new terminology.

  - Add support for execution plans
  - Deprecate old workflow format (old workflows are supported and will be automatically converted into the new "execution plans")
  - Update terminology across the codebase and docs
  - Remove strict mode

- 101f5a1: Autoinstall adaptors by default (pass `--no-autoinstall` to disable)

### Patch Changes

- Updated dependencies
  - @openfn/logger@1.0.0
  - @openfn/deploy@0.4.2
  - @openfn/runtime@1.0.0
  - @openfn/compiler@0.0.40

## 0.4.16

### Patch Changes

- Updated dependencies [649ca43]
  - @openfn/logger@0.0.20
  - @openfn/compiler@0.0.39
  - @openfn/deploy@0.4.1
  - @openfn/runtime@0.2.6

## 0.4.15

### Patch Changes

- Updated dependencies [0f22694]
  - @openfn/runtime@0.2.5

## 0.4.14

### Patch Changes

- Updated dependencies [2f7148c]
  - @openfn/deploy@0.4.0

## 0.4.13

### Patch Changes

- Updated dependencies [3f0010e]
- Updated dependencies [56b6e44]
  - @openfn/deploy@0.3.0
  - @openfn/runtime@0.2.4

## 0.4.12

### Patch Changes

- Updated dependencies [f228fd5]
  - @openfn/runtime@0.2.3

## 0.4.11

### Patch Changes

- 2ccee70: Fix an issue where an error is thrown if a job does not return state
- Updated dependencies [02ab459]
  - @openfn/runtime@0.2.2

## 0.4.10

### Patch Changes

- Updated dependencies
  - @openfn/runtime@0.2.1

## 0.4.9

### Patch Changes

- Updated dependencies [3c2de85]
  - @openfn/runtime@0.2.0
  - @openfn/deploy@0.2.10

## 0.4.8

### Patch Changes

- Updated dependencies [857c42b]
  - @openfn/runtime@0.1.4

## 0.4.7

### Patch Changes

- Updated dependencies [7f352d2]
  - @openfn/runtime@0.1.3

## 0.4.6

### Patch Changes

- Updated dependencies [419f276]
- Updated dependencies [0e66f5a]
  - @openfn/runtime@0.1.2

## 0.4.5

### Patch Changes

- Updated dependencies [c448a23]
  - @openfn/runtime@0.1.1

## 0.4.4

### Patch Changes

- bff64f7: Updated error reporting
- Updated dependencies [a540888]
  - @openfn/runtime@0.1.0

## 0.4.3

### Patch Changes

- Updated dependencies [ca701e8]
  - @openfn/logger@0.0.19
  - @openfn/compiler@0.0.38
  - @openfn/deploy@0.2.9
  - @openfn/runtime@0.0.33

## 0.4.2

### Patch Changes

- Updated dependencies [1b6fa8e]
  - @openfn/logger@0.0.18
  - @openfn/runtime@0.0.32
  - @openfn/compiler@0.0.37
  - @openfn/deploy@0.2.8

## 0.4.1

### Patch Changes

- Fix an issue where state.data as an array would be corrupted
- 7f4340d: Fixed resulting projectState.json from pull; fixed URLs in deploy
- 10021f6: Handle 404s when trying to deploy; better logging/error messages
- Updated dependencies
  - @openfn/runtime@0.0.31
  - @openfn/deploy@0.2.7

## 0.4.0

### Minor Changes

- d0a292f: Added sanitize option

### Patch Changes

- 102de2d: Always log errors (even if log=none)
- Updated dependencies [102de2d]
- Updated dependencies
  - @openfn/logger@0.0.17
  - @openfn/runtime@0.0.30
  - @openfn/compiler@0.0.36
  - @openfn/deploy@0.2.6

## 0.3.1

### Patch Changes

- Fix expected Lightning provisining path for versions greater than Lightning v0.7.3
- Updated dependencies
  - @openfn/deploy@0.2.5

## 0.3.0

### Minor Changes

- add a projectId option to pull, allowing to pull a project without a local state file

### Patch Changes

- 4b23423: Internal refactor of options
- Updated dependencies
  - @openfn/deploy@0.2.4

## 0.2.4

### Patch Changes

- Updated dependencies [2a0aaa9]
  - @openfn/compiler@0.0.35
  - @openfn/runtime@0.0.29
  - @openfn/deploy@0.2.3
  - @openfn/logger@0.0.16

## 0.2.3

### Patch Changes

- Deploy test(no diff)

## 0.2.2

### Patch Changes

- faf1852: Downgrade tsup
- Updated dependencies [faf1852]
  - @openfn/compiler@0.0.34
  - @openfn/deploy@0.2.2
  - @openfn/describe-package@0.0.18
  - @openfn/logger@0.0.15
  - @openfn/runtime@0.0.28

## 0.2.1

### Patch Changes

- 4c875b3: Bump yargs version
- Updated dependencies [749afe8]
- Updated dependencies [614c86b]
- Updated dependencies [4c875b3]
- Updated dependencies [4c875b3]
  - @openfn/logger@0.0.14
  - @openfn/runtime@0.0.27
  - @openfn/compiler@0.0.33
  - @openfn/deploy@0.2.1
  - @openfn/describe-package@0.0.17

## 0.2.0

### Minor Changes

- df9d54c: users can now specify project description and cron trigger expression via CLI deploy
- fdf8cc2: Add --describe option to deploy

### Patch Changes

- Updated dependencies
  - @openfn/deploy@0.2.0

## 0.1.0

### Minor Changes

- c218a11: Added deploy command

### Patch Changes

- Updated dependencies [c218a11]
  - @openfn/deploy@0.1.0

## 0.0.41

### Patch Changes

- 8ac138f: Ensure workflows can use the monorepo
- Updated dependencies
  - @openfn/runtime@0.0.26

## 0.0.40

### Patch Changes

- e5e1d7d: Refactor repo command
- fd946a7: Fix CLI docs (strict mode, workflow with autoinstall)
- Updated dependencies [2024ce8]
  - @openfn/runtime@0.0.25

## 0.0.39

### Patch Changes

- f9b9e07: Tweak log output
- 5b2a866: Run in non-strict mode by default
- 8d5c405: Rename strict-output -> strict
- 26024a7: Better error handling and reporting

- Updated dependencies [6f51ce2]
  - @openfn/logger@0.0.13
  - @openfn/runtime@0.0.24
  - @openfn/compiler@0.0.32

## 0.0.38

### Patch Changes

- 91a3311: checked-in package-lock changes for language-common
- Updated dependencies [91a3311]
  - @openfn/compiler@0.0.31
  - @openfn/runtime@0.0.23

## 0.0.37

### Patch Changes

- c341ff0: Update test command for new runtime
- 1e6db3b: Don't use fast-safe-stringify
- Workflow support
- Updated dependencies [c341ff0]
  - @openfn/compiler@0.0.30
  - @openfn/runtime@0.0.22

## 0.0.36

### Patch Changes

- b66217c: Tighten up credential logging in metadata service"

## 0.0.35

### Patch Changes

- 7df08d4: Support monorepo when looking for common
- Updated dependencies [7df08d4]
  - @openfn/describe-package@0.0.16
  - @openfn/compiler@0.0.29

## 0.0.34

### Patch Changes

- f744f00: Update help
- 02bcef5: Optionally disable auto-import
- Updated dependencies [f4b9702]
  - @openfn/compiler@0.0.28
  - @openfn/logger@0.0.12
  - @openfn/runtime@0.0.21

## 0.0.33

### Patch Changes

- Updated dependencies
  - @openfn/describe-package@0.0.15
  - @openfn/compiler@0.0.27

## 0.0.32

### Patch Changes

- Updated dependencies [60f695f]
- Updated dependencies [d67f45a]
  - @openfn/runtime@0.0.20
  - @openfn/logger@0.0.11
  - @openfn/compiler@0.0.26

## 0.0.31

### Patch Changes

- 64e8517: Refactor execute and compile commands

## 0.0.30

### Patch Changes

- d128c98: Fix adaptor version string in lightning

## 0.0.29

### Patch Changes

- 38ad73e: Support adaptor paths in version readout
- 56af9d3: tidy test command output
- 6c1eb8b: CLI no longer attempts to load state.json by default
- Updated dependencies [38ad73e]
  - @openfn/logger@0.0.10
  - @openfn/compiler@0.0.25
  - @openfn/runtime@0.0.19

## 0.0.28

### Patch Changes

- e43d3ba: Support logging to JSON
- 0026846: Load adaptors from monorepo
- Updated dependencies [e43d3ba]
- Updated dependencies [e43d3ba]
  - @openfn/logger@0.0.9
  - @openfn/runtime@0.0.18
  - @openfn/compiler@0.0.24

## 0.0.27

### Patch Changes

- 4c57da1: Add validation checks for adaptor usage
- Updated dependencies [19e9f31]
  - @openfn/runtime@0.0.17

## 0.0.26

### Patch Changes

- Updated dependencies
  - @openfn/compiler@0.0.23
  - @openfn/runtime@0.0.16

## 0.0.25

### Patch Changes

- Updated dependencies [986bf07]
- Updated dependencies [5c6fde4]
  - @openfn/runtime@0.0.15

## 0.0.24

### Patch Changes

- 74cc00f: Fix example display in docgen
- 8ccb78d: Hide docgen command
- 5d9dd10: Set job timeout through CLI
- c1e24a5: Fix an issue when running the docs command with no version number
- Updated dependencies [47ac1a9]
- Updated dependencies [1695874]
- Updated dependencies [74cc00f]
  - @openfn/runtime@0.0.14
  - @openfn/describe-package@0.0.14
  - @openfn/compiler@0.0.22

## 0.0.23

### Patch Changes

- b7265c8: Log version information
- Updated dependencies [454a06b]
  - @openfn/compiler@0.0.21

## 0.0.22

### Patch Changes

- Updated dependencies [1a2d04a]
  - @openfn/describe-package@0.0.13
  - @openfn/compiler@0.0.20

## 0.0.21

### Patch Changes

- 4442a41: Forward spawned child process exit code to CLI process on exit

## 0.0.20

### Patch Changes

- 8d0f029: Add docgen and docs commands
- 7571536: Fix hang on windows
- Updated dependencies [e95c133]
  - @openfn/logger@0.0.8
  - @openfn/compiler@0.0.19
  - @openfn/runtime@0.0.13

## 0.0.19

### Patch Changes

- @openfn/compiler@0.0.18

## 0.0.18

### Patch Changes

- 68b4208: Support circular structures in JSON output
  Introduce strict output (by default) which only serializes data
  Never serialize configuration to output
- Updated dependencies
  - @openfn/logger@0.0.7
  - @openfn/compiler@0.0.17
  - @openfn/runtime@0.0.12

## 0.0.17

### Patch Changes

- 7f68a40: Update global list
- Updated dependencies [7f68a40]
  - @openfn/compiler@0.0.16

## 0.0.16

### Patch Changes

- @openfn/compiler@0.0.15

## 0.0.15

### Patch Changes

- ba9bf80: Bug fixes
- Updated dependencies [ba9bf80]
- Updated dependencies [2d07777]
  - @openfn/runtime@0.0.11
  - @openfn/logger@0.0.6
  - @openfn/compiler@0.0.14

## 0.0.14

### Patch Changes

- @openfn/compiler@0.0.13

## 0.0.13

### Patch Changes

- ef9406b: Support auto-install of modules
- Updated dependencies
  - @openfn/logger@0.0.5
  - @openfn/runtime@0.0.10
  - @openfn/compiler@0.0.12

## 0.0.12

### Patch Changes

- 6d1d199: Support mutability in the runtime
- 41bdfdc: Don't try and import globals like Promise or Date
- 28168a8: Updated build process
- Updated dependencies
  - @openfn/runtime@0.0.9
  - @openfn/compiler@0.0.11
  - @openfn/logger@0.0.4

## 0.0.11

### Patch Changes

- Updated dependencies [1d293ae]
  - @openfn/compiler@0.0.10

## 0.0.10

### Patch Changes

- 92e5427: bump everything, npm package.json issues
- Updated dependencies [92e5427]
  - @openfn/compiler@0.0.9
  - @openfn/logger@0.0.3
  - @openfn/runtime@0.0.8

## 0.0.9

### Patch Changes

- Updated dependencies
  - @openfn/runtime@0.0.7

## 0.0.8

### Patch Changes

- Updated dependencies
  - @openfn/runtime@0.0.6

## 0.0.7

### Patch Changes

- f79bf9a: Added logger service to CLI, compiler and runtime
- Updated dependencies [f79bf9a]
  - @openfn/compiler@0.0.8
  - @openfn/logger@0.0.2
  - @openfn/runtime@0.0.5

## 0.0.6

### Patch Changes

- 5623913: Allow execute() function to be overriden by adaptors and jobs
- fb2b570: Fix version warning in cli
- Updated dependencies [5623913]
  - @openfn/compiler@0.0.7
  - @openfn/runtime@0.0.4

## 0.0.5

### Patch Changes

- 27c6434: Added a --test command to the cli
- 8a5311b: Added support for a --version flag in the cli
  - @openfn/compiler@0.0.6

## 0.0.4

### Patch Changes

- 8148cd5: Updated builds
- Updated dependencies [8148cd5]
  - @openfn/compiler@0.0.5
  - @openfn/runtime@0.0.3

## 0.0.3

### Patch Changes

- 3f6dc98: Initial release of new runtime, compiler and cli
- Updated dependencies [b5ce654]
- Updated dependencies [3f6dc98]
  - @openfn/runtime@0.0.2
  - @openfn/compiler@0.0.4
