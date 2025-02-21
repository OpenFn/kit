---
'@openfn/ws-worker': minor
---

Respond to `work:available` events.

When the worker receives `work:available` in the worker queue, it'll instantly trigger a claim event.

This claim is independent of the workloop and does not affect backoff in any way.
