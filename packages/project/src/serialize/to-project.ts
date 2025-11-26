import { omitBy, isNil } from 'lodash-es';

import type {
  SerializedProject,
  SerializedWorkflow,
} from '../parse/from-project';
import Project from '../Project';
import { jsonToYaml } from '../util/yaml';

const SERIALIZE_VERSION = 2;

type ToProjectOptions = {
  /** What serialisation version should we write to? defaults to the highest supported by this CLI. For v1, use `Project.serialize('state)`  */
  version?: number;

  /** What file format should be returned? Defaults from workspace config */
  format?: 'yaml' | 'json';
};

export default (project: Project, options: ToProjectOptions = {}) => {
  // return a compatible json structure
  const proj: SerializedProject = omitBy(
    {
      id: project.id,
      name: project.name,
      version: SERIALIZE_VERSION, // important!
      description: project.description,

      collections: project.collections,
      credentials: project.credentials,

      openfn: project.openfn,
      meta: project.meta,
      options: omitBy(project.options, isNil),

      //workflows: project.workflows.map(mapWorkflow) as SerializedWorkflow[],
      workflows: project.workflows.map((w) =>
        w.toJSON()
      ) as SerializedWorkflow[],
    },
    isNil
  ) as SerializedProject;

  const format = options.format ?? proj.config?.formats.project;

  if (format === 'json') {
    return proj;
  }
  return jsonToYaml(proj);
};
