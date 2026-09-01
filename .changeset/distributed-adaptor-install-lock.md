---
'@openfn/engine-multi': minor
'@openfn/ws-worker': minor
---

Add a filesystem-based lock so multiple workers can safely share a single adaptor repo directory (e.g. an NFS mount or k8s PVC). The lock lives inside engine-multi's autoinstall and serialises installs across processes via a per-adaptor lockfile. It is enabled by default and can be disabled with `WORKER_NO_REPO_LOCK=true` (or `--no-repo-lock`) on ws-worker. The engine's `isInstalled` check has also been tightened to verify the adaptor's `node_modules` entry exists on disk, not just the repo `package.json` dependency entry — this catches half-installed adaptors left behind by a crashed worker.
