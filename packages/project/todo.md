- step names need to slugify the openfn name, and also openfn needs to save the original name
- workflow id needs to be a slugified form of the name
- include an options key on the project and workflow

- have I got a problem with triggers? If creating a local project, the cli doesn't need it, but the provisioner does. Maybe we auto-generate one if it doesn't exist? Probably under an option

- We don't need to map out triggers to files (do and test)

- we need to understand a repo - ie, what projects exist?

- the openfn file needs to contain a project key which represents the currently connected project

--

have I hit a problem?

When I copy a workflow yaml from the app, it looks like this:

```
name: AI testing
jobs:
  New-job:
    name: New job
    adaptor: "@openfn/language-common@latest"
    body: |
      // Check out the Job Writing Guide for help getting started:
      // https://docs.openfn.org/documentation/jobs/job-writing-guide
triggers:
  webhook:
    type: webhook
    enabled: false
edges:
  webhook->New-job:
    source_trigger: webhook
    target_job: New-job
    condition_type: always
    enabled: true
```

But this isn't the native workflow file format. That's the lightning format.

Now.. that's sort of OK for me. I'll just use the correct local format in my tests. But I wonder.

I can't go into a local workflow.yaml, copy out the the contents, and paste it into the app. Because the format is different.

there are two things in play:

runtime workflow format, in json or yaml, and that's what I'm designing for

versus

lightning workflow format (state format), in json or yaml

everything is interopable apart from these two low level data structures
