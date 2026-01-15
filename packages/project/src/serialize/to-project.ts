import * as l from '@openfn/lexicon';
import { omitBy, isNil } from 'lodash-es';

import type {
  SerializedProject,
  SerializedWorkflow,
} from '../parse/from-project';
import Project from '../Project';
import { jsonToYaml } from '../util/yaml';
import { WithMeta } from '../Workflow';
import { tidyOpenfn } from '../util/omit-nil';

const SERIALIZE_VERSION = 2;

type ToProjectOptions = {
  /** What serialisation version should we write to? defaults to the highest supported by this CLI. For v1, use `Project.serialize('state)`  */
  version?: number;

  /** What file format should be returned? Defaults from workspace config */
  format?: 'yaml' | 'json';
};

export default (project: Project, options: ToProjectOptions = {}) => {
  // return a compatible json structure
  const { alias, ...cliWithoutAlias } = project.cli;
  const proj: SerializedProject = omitBy(
    {
      id: project.id,
      name: project.name,
      cli: {
        ...cliWithoutAlias,
        version: SERIALIZE_VERSION, // important!
      },
      description: project.description,

      collections: project.collections,
      credentials: project.credentials,

      openfn: omitBy(project.openfn, isNil),
      options: omitBy(project.options, isNil),

      workflows: project.workflows.map((w) => {
        const obj = w.toJSON() as SerializedWorkflow;
        tidyOpenfn(obj);
        if (obj.steps) {
          obj.steps = obj.steps.sort((a: any, b: any) => {
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
          });
          obj.steps.forEach((s: WithMeta<l.Step>) => {
            tidyOpenfn(s);
            if (s.next && typeof s.next !== 'string') {
              for (const id in s.next) {
                tidyOpenfn(s.next[id]);
              }
            }
          });
        }
        return obj;
      }),
    },
    isNil
  ) as SerializedProject;

  // only write the sandbox key if this project is itself a sandbox
  if (project.sandbox?.parentId) {
    proj.sandbox = {
      parentId: project.sandbox.parentId,
    };
  }

  const format = options.format ?? proj.config?.formats.project;

  if (format === 'json') {
    return proj;
  }
  return jsonToYaml(proj);
};
