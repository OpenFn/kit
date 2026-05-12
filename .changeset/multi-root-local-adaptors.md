---
'@openfn/ws-worker': minor
---

Support colon-separated `OPENFN_ADAPTORS_REPO` so a private adaptor monorepo can be loaded alongside the canonical OpenFn adaptors monorepo. When a job pins an adaptor to `@local`, the worker now walks the configured roots in order and resolves to the first root that contains `packages/<shortName>/package.json`. Single-path values continue to work unchanged. Earlier paths win on collision, mirroring Lightning's `AdaptorRegistry` precedence rules so the registry view and the worker's execution path stay consistent.
