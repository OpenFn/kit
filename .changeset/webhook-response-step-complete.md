---
'@openfn/ws-worker': minor
'@openfn/runtime': minor
'@openfn/lexicon': minor
---

Forward `state.webhookResponse` to Lightning on `step:complete`.

If a job sets `state.webhookResponse = { status, body }` (camelCase in job
code), the worker extracts it from user state and attaches it to the
`step:complete` payload as `webhook_response` (snake_case, matching the rest
of the wire payload). The key is stripped from the persisted dataclip
(worker) and from the next step's input state (runtime), so it cannot leak.
Lightning decides when to flush the HTTP response based on the trigger
configuration.
