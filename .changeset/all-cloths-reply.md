---
'@openfn/cli': minor
---

When running `execute` inside a Workspace (a folder with an `openfn.yaml` file), allow workflows to be run directly. Ie:

```bash
openfn process-patients
```

Instead of:

```
openfn ./workflows/process-patients/process-patients.yaml
```

When running through a Workspace, credential maps and collections endpoints are automatically applied for you.
