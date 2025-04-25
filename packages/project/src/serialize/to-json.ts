// serialize to simple json

import { Project } from '../Project';

// TODO need a suite of unit tests against this
export default function (project: Project) {
  return {
    // There must be a better way to do this?
    // Do we just serialize all public fields?
    name: project.name,
    description: project.description,
    env: project.env,
    meta: project.meta,
    workflows: project.workflows,
    collections: project.collections,
    credentials: project.credentials,
    openfn: project.openfn,
    options: project.options,
  };
}
