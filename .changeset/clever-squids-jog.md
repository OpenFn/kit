---
'@openfn/describe-package': patch
'@openfn/lightning-mock': patch
'@openfn/engine-multi': patch
'@openfn/ws-worker': patch
'@openfn/compiler': patch
'@openfn/runtime': patch
'@openfn/deploy': patch
'@openfn/logger': patch
'@openfn/cli': patch
---

Ensure support for node 18,20 and 22.

This update ensures compatibility with node 18 LTS, 20 LTS, and 22.12.

Most of the changes are in the build and test suites and have only minor impact on production code. No issues are anticipated as as result of this change.

Early versions may fail on node 20 and 22.

Support for node 18 will be removed in late 2025.
