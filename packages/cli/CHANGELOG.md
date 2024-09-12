# @openfn/cli

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
