// serialize to simple json

import { Project } from '../Project';

export default function (project: Project) {
  return {
    name: project.name,
    openfn: project.openfn,
    workflows: project.workflows,
  };
}
