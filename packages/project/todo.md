- step names need to slugify the openfn name, and also openfn needs to save the original name
- workflow id needs to be a slugified form of the name
- include an options key on the project and workflow

- have I got a problem with triggers? If creating a local project, the cli doesn't need it, but the provisioner does. Maybe we auto-generate one if it doesn't exist? Probably under an option

- We don't need to map out triggers to files (do and test)

- we need to understand a repo - ie, what projects exist?

- the openfn file needs to contain a project key which represents the currently connected project
