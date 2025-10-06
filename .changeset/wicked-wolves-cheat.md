---
'@openfn/integration-tests-worker': patch
'@openfn/runtime': patch
---

Fix an issue where certain error messages are badly processed the runtime & worker. This resulted in cryptic errors like "src.js is not in the SourceMap".
