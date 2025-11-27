# @openfn/logger

## 1.1.0

### Minor Changes

- 2cc28a6: Add colour to output

## 1.0.6

### Patch Changes

- Update dependencies

## 1.0.5

### Patch Changes

- 0a176aa: In JSON mode, don't log empty messages

## 1.0.4

### Patch Changes

- 6e87156: Fix an issue where print logs don't get picked up by the worker

## 1.0.3

### Patch Changes

- Ensure support for node 18,20 and 22.

  This update ensures compatibility with node 18 LTS, 20 LTS, and 22.12.

  Most of the changes are in the build and test suites and have only minor impact on production code. No issues are anticipated as as result of this change.

  Prior releases may fail on node version >=20.

  Support for node 18 will be removed in late 2025.

## 1.0.2

### Patch Changes

- c3df1e5: Partially update vulnerable versions of braces - live-server is a holdout as there is not a newer version available.

## 1.0.1

### Patch Changes

- 2fde0ad: Don't blow up if an object with a null prototype is sent through

## 1.0.0

### Major Changes

- 86dd668: Symbolic 1.0 version release

### Patch Changes

- 649ca43: In JSON mode, do not stringify emitted messages.
  Better handling of error objects
- 9f6c35d: Support proxy() on the mock logger

## 0.0.20

### Patch Changes

- 649ca43: In JSON mode, do not stringify emitted messages.
  Better handling of error objects

## 0.0.19

### Patch Changes

- ca701e8: Log json with high-resolution timestamp

## 0.0.18

### Patch Changes

- 7e4529e: Export SanitizePolicies type
- 1b6fa8e: Add proxy function

## 0.0.17

### Patch Changes

- 102de2d: Always log errors (even if log=none)
- 102de2d: If log=none, don't log job logs
- 3995316: Don't log null

## 0.0.16

### Patch Changes

- 2a0aaa9: Bump inquirer

## 0.0.15

### Patch Changes

- faf1852: Downgrade tsup

## 0.0.14

### Patch Changes

- 749afe8: Pretty print output
- 4c875b3: minor version bumps

## 0.0.13

### Patch Changes

- 2696581: Don't stringify error objects
- 3cc4456: Add an 'always' log level
- 92e9fdc: mock break() shoulnd't print anything
- 6f51ce2: Add a \_find function to the mock

## 0.0.12

### Patch Changes

- 8dfc5bf: include a timestamp on json logs

## 0.0.11

### Patch Changes

- d67f45a: print should log as json

## 0.0.10

### Patch Changes

- 38ad73e: export extra typings

## 0.0.9

### Patch Changes

- e43d3ba: Support logging to JSON

## 0.0.8

### Patch Changes

- e95c133: Add a print() function

## 0.0.7

### Patch Changes

- 0b6c0ff: Replace confirm utility to remove security vulnerability
- 4555139: Allow null and undefined to be logged

## 0.0.6

### Patch Changes

- 2d07777: Fix state sanitisation

## 0.0.5

### Patch Changes

- f1a957c: Added a confirm utility
- e9cbc06: Export a default logger

## 0.0.4

### Patch Changes

- 28168a8: Updated build process

## 0.0.3

### Patch Changes

- 92e5427: bump everything, npm package.json issues

## 0.0.2

### Patch Changes

- f79bf9a: Added logger service to CLI, compiler and runtime
