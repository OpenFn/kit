import * as l from '@openfn/lexicon';

import Project from '../Project';
import ensureJson from '../util/ensure-json';
import { Provisioner } from '@openfn/lexicon/lightning';
import fromAppState, { fromAppStateConfig } from './from-app-state';
import fromAppSpec, { isAppSpec } from './from-app-spec';
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
    /**
     * Load this project as a spec, stripping any embedded remote state
     * (workflow/step/edge uuids) as it's parsed - eg when a stateful,
     * previously-fetched project.yaml is being deployed as a brand new
     * project, and its old ids must not carry over.
     */
    asSpec?: boolean;
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
    return new Project(
      from_v2(rawJson as SerializedProject, config?.asSpec),
      config
    );
  }

  // a v1 spec has no uuids to preserve, so convert it to the v2 spec shape
  // and let the v2 parser take it - fromAppState is for v1 STATE, and its
  // uuid-based matching silently mangles a spec
  if (isAppSpec(rawJson)) {
    return new Project(fromAppSpec(rawJson), config);
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
const from_v2 = (data: SerializedProject, asSpec?: boolean) => {
  // nothing to do
  // (When we add v3, we'll ned to migrate through this)
  if (asSpec) {
    return stripState(data);
  }
  return {
    ...data,
  };
};

// Remove embedded remote-state uuids from every workflow, step and edge
// (but not the project itself - callers handle that separately, since
// they also need to set a fresh endpoint)
const stripState = (data: SerializedProject) => ({
  ...data,
  workflows: (data.workflows ?? []).map((wf: any) => {
    const { openfn, steps, ...restWf } = wf;
    return {
      ...restWf,
      steps: (steps ?? []).map((step: any) => {
        const { openfn: stepOpenfn, next, ...restStep } = step;
        if (!next) return restStep;
        return {
          ...restStep,
          next: Object.fromEntries(
            Object.entries(next).map(([id, edge]: [string, any]) => {
              const { openfn: edgeOpenfn, ...restEdge } = edge;
              return [id, restEdge];
            })
          ),
        };
      }),
    };
  }),
});
