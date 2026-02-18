import * as l from '@openfn/lexicon';

import Project from '../Project';
import ensureJson from '../util/ensure-json';
import { Provisioner } from '@openfn/lexicon/lightning';
import fromAppState, { fromAppStateConfig } from './from-app-state';
import { WithMeta } from '../Workflow';

// Load a project from any JSON or yaml representation
// This is backwards-compatible with v1 state.json files
// But is really designed for v2 project.yaml files

// TODO move these types to a common types.ts, or maybe Project.ts
export type SerializedProject = Omit<Partial<l.Project>, 'workflows'> & {
  version: number;
  workflows: SerializedWorkflow[];
};

export type SerializedWorkflow = {
  id: string;
  name: string;

  steps: WithMeta<Array<l.Job | l.Trigger>>;

  openfn?: l.ProjectMeta;
};

export default (
  data: l.Project | SerializedProject | string,
  config?: Partial<l.WorkspaceConfig> & { alias?: string; version?: number }
) => {
  // first ensure the data is in JSON format
  let rawJson = ensureJson<any>(data);

  if (rawJson.cli?.version ?? rawJson.version /*deprecated*/) {
    // If there's any version key at all, its at least v2
    return new Project(from_v2(rawJson as SerializedProject), config);
  }

  return from_v1(rawJson as Provisioner.Project, config as fromAppStateConfig);
};

// TODO test that config (alias) works
const from_v1 = (
  data: Provisioner.Project,
  config: fromAppStateConfig = {}
) => {
  return fromAppState(data, {}, config);
};

// TODO this should return a Project really!
const from_v2 = (data: SerializedProject) => {
  // nothing to do
  // (When we add v3, we'll ned to migrate through this)
  return {
    ...data,
  };
};
