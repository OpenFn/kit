---
'@openfn/ws-worker': minor
---

Add optional filesystem-based lock so multiple ws-workers can safely share a single repo directory (e.g. an NFS mount or k8s PVC). When `WORKER_REPO_LOCK=true` (or `--repo-lock`) is set alongside `WORKER_REPO_DIR`, adaptor installs are serialised across workers via a per-adaptor lockfile and a sentinel cache. The cache-hit path stays lock-free.
