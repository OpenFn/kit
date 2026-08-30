---
'@openfn/deploy': patch
---

Stop `deploy` reporting a removal for trigger fields the payload does not carry. Absence means "leave this alone", so a field held on the server and never named in the spec was shown as being removed when it was not. This affected `webhook_reply` and `webhook_response_config` already, and would have affected `custom_path`.
