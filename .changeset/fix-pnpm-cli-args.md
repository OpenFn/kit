---
'@openfn/ws-worker': patch
---

Fix CLI argument parsing when invoked via `pnpm start -- --queues ...`. pnpm v7+ passes the `--` separator through to `process.argv`, causing yargs to treat all flags as positional arguments. A leading `--` is now stripped before parsing.
