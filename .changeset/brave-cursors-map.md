---
'@openfn/project': patch
'@openfn/cli': patch
---

deploy v2: Fix an issue where a cron trigger's `cron_cursor_job_id` is sent as a step id instead of a UUID, so Lightning rejects the deploy
