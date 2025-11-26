import * as l from '@openfn/lexicon';

import Project from '../Project';
import ensureJson from '../util/ensure-json';
import { Provisioner } from '@openfn/lexicon/lightning';
import fromAppState from './from-app-state';
import slugify from '../util/slugify';

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

  // jobs: SerializedJob[];
  // triggers: SerializedTrigger[];
  // edges: SerializedEdge[];
  steps: l.Step[];

  openfn?: l.ProjectMeta;
};

export default (data: l.Project | SerializedProject | string) => {
  // first ensure the data is in JSON format
  let rawJson = ensureJson<any>(data);

  let json;
  if (rawJson.version) {
    // If there's any version key at all, its at least v2
    json = from_v2(rawJson as SerializedProject);
  } else {
    json = from_v1(rawJson as Provisioner.Project);
  }

  return new Project(json);
};

const from_v1 = (data: Provisioner.Project) => {
  // TODO is there any way to look up the config file?
  // But we have no notion of a working dir here
  // Maybe there are optional options that can be provided
  // by from fs or from path
  return fromAppState(data);
};

// Actually we should serialize the workflow using lighting's
// structure
// Let's do that here in the state file now, so it's like v1
// Let's work out the expanded workflow.yaml file later
const from_v2 = (data: SerializedProject) => {
  // nothing to do
  // (When we add v3, we'll ned to migrate through this)
  return {
    ...data,
    // workflows: data.workflows.map(mapWorkflow),
  };
};

// This maps project workflows, which broadly follow the provisioner
// structure, into the internal runtime workflow structures
// TODO this probably needs its own set of unit tests
export const mapWorkflow = (workflow: SerializedWorkflow) => {
  const { jobs, edges, triggers } = workflow;

  const mapped: l.Workflow = {
    id: workflow.id ?? slugify(workflow.name),
    name: workflow.name,
    steps: [],
    openfn: workflow.openfn,
  };

  triggers.forEach((trigger) => {
    const connectedEdges = edges.filter(
      (e) => e.source_trigger_id === trigger.id
    );
    mapped.steps.push({
      id: trigger.id ?? trigger.type ?? 'trigger',
      type: trigger.type,
      openfn: trigger.openfn,
      next: connectedEdges.reduce((obj: any, edge) => {
        const target = jobs.find((j) => j.id === edge.target_job_id);
        if (!target) {
          throw new Error(`Failed to find ${edge.target_job_id}`);
        }
        // we use the name, not the id, to reference
        obj[slugify(target.name)] = mapTriggerEdgeCondition(edge);
        return obj;
      }, {}),
    } as l.Trigger);
  });

  jobs.forEach((step) => {
    const outboundEdges = edges.filter(
      (e) => e.source_job_id === step.id || e.source_trigger_id === step.id
    );

    const { body: expression, name, adaptor } = step;

    const s: any = {
      id: slugify(name),
      name: name,
      expression,
      adaptor,
      openfn: step.openfn,
    };

    if (outboundEdges.length) {
      s.next = outboundEdges.reduce((next, edge) => {
        const target = jobs.find((j) => j.id === edge.target_job_id);
        // @ts-ignore
        next[slugify(target.name)] = mapTriggerEdgeCondition(edge);
        return next;
      }, {});
    }
    mapped.steps.push(s);
  });

  return mapped;
};

const mapTriggerEdgeCondition = (edge: SerializedEdge) => {
  const e: any = {
    disabled: !edge.openfn?.enabled,
  };
  if (edge.condition_type === 'always') {
    e.condition = true;
  } else if (edge.condition_type === 'never') {
    e.condition = false;
  } else {
    e.condition = edge.condition_expression;
  }

  // Do this last so that it serializes last
  e.openfn = {
    uuid: edge.id,
  };
  return e;
};
