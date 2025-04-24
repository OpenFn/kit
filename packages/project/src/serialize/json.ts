// serialize to simple json

import { Project } from '../Project';

// TODO need a suite of unit tests against this
export default function (project: Project) {
  return {
    name: project.name,
    description: project.description,
    env: project.env,
    openfn: project.openfn,
    workflows: project.workflows,
  };
}
