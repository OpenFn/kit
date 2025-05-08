- step names need to slugify the openfn name, and also openfn needs to save the original name
- workflow id needs to be a slugified form of the name
- include an options key on the project and workflow

- have I got a problem with triggers? If creating a local project, the cli doesn't need it, but the provisioner does. Maybe we auto-generate one if it doesn't exist? Probably under an option

- We don't need to map out triggers to files (do and test)

- we need to understand a repo - ie, what projects exist?

- the openfn file needs to contain a project key which represents the currently connected project

- need to ensure the project name is in openfn.yaml

- maybe have a link to the project at the endpoint? in the openfn file? Or maybe CLI can generate it

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

---

Ok, next steps are better CLI integration

- I want to be able to edit and deploy
- I want to be abel to execute using project

When all that's done, although it isn't perfect, I think I can release the beta

There are lots of little details that aren't quite right

--

I think I'm missing something big

workflow.yaml on the file system does not have UUIDs in

So when I load from the file system, I need to take care to lookup the UUIDs

And if UUIDs don't exist, because it's something I've just created, I need to generate them

Do UUIDs get generated in the serialisation step? Yes I think so, because that's the only peerson who cares

So when I load from the filesystem, I need to keep the project file handy so I can map uuids. And when I check out a new project, I need to update that stuff

Maybe the Project needs a UUID map which can be used in serialisation. Or do we just keep it in memory, with other app only stuff?

---

there's actually something really important here

when i scan the fs for the workflows, and I try to match a uuid in the state file, we're already diffing

This process of scanning from the fs is surely doing a lot of the diff work. It should know, I think, that there are new/untracked steps. It might know if they've been renamed?

I'm not sure: but this is actually quite a big problem. I need to take my time here
