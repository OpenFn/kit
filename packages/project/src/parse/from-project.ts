import * as l from '@openfn/lexicon';

import Project from '../Project';
import ensureJson from '../util/ensure-json';
import { Provisioner } from '@openfn/lexicon/lightning';
import fromAppState, { fromAppStateConfig } from './from-app-state';
import detectVersion from '../util/detect-version';

// Load a project from any JSON or yaml representation
// This is backwards-compatible with v1 state.json files
// But is really designed for v2 project.yaml files

// TODO move these types to a common types.ts, or maybe Project.ts
export type SerializedProject = l.ProjectState;

export type SerializedWorkflow = l.WorkflowState;

export default (
  data: l.ProjectState | SerializedProject | string,
  config?: Partial<l.WorkspaceConfig> & {
    alias?: string;
    version?: number;
    name?: string;
  }
) => {
  // first ensure the data is in JSON format
  let rawJson = ensureJson<any>(data);

  // an explicit name override (eg deploying a downloaded project.yaml as a
  // new/duplicate project) applies regardless of source format
  if (config?.name) {
    rawJson = { ...rawJson, name: config.name };
  }

  if (detectVersion(rawJson) > 1) {
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
