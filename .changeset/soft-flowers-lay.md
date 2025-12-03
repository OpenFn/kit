---
'@openfn/cli': minor
---

Add a fetch command, which will download a project from an app but not check it out. This will throw if the local project version has diverged from the remote version.

Rebased `pull --beta` to simply be fetch & checkout
