---
'@openfn/ws-worker': minor
---

Fastlane support: multiple concurrent workloops, each with its own isolated capacity and backoff.

Claims also include a `queues` key, which specifies a prioritised list of Lightning work queues to claim from.

Configure workloops with the `--workloops` CLI option or env. By default the worker users `manual>*5`, which provides parity behaviour to prior production.
