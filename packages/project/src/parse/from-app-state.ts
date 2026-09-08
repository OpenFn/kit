// Load a Project from v1 app state

import * as l from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';

import { Project } from '../Project';
import renameKeys from '../util/rename-keys';
import slugify from '../util/slugify';
import omitNil from '../util/omit-nil';
import ensureJson from '../util/ensure-json';
import getCredentialName from '../util/get-credential-name';

export type fromAppStateConfig = Partial<l.WorkspaceConfig> & {
  format?: 'yaml' | 'json';
  alias?: string;

  // Step ids already written down locally, keyed by step name. An id we have
  // used before wins over one derived from the name, so two names that shorten
  // to the same thing cannot land on top of each other.
  //
  // Keyed by name rather than by the step's uuid because the workflow file does
  // not carry uuids. That is why a rename still moves a step: there is nothing
  // on disk tying the new name to the old id.
  recordedStepIds?: Record<string, string>;
};

export default (
  state: Provisioner.Project | string,
  meta: Partial<l.ProjectMeta> = {},
  config: fromAppStateConfig = {}
) => {
  let stateJson = ensureJson<Provisioner.Project>(state);
  delete config.format;

  const {
    id,
    name,
    description,
    workflows,
    project_credentials = [],
    collections,
    channels,
    inserted_at,
    updated_at,
    parent_id,
    ...options
  } = stateJson;

  // subtle mapping of credentials keys to align with lexicon
  const credentials = project_credentials.map((c) => ({
    uuid: c.id,
    name: c.name,
    owner: c.owner,
  }));

  // same mapping for collections - the server's `id` becomes our `uuid`.
  // stays undefined (not []) when absent, matching how channels is handled
  const collectionsList = collections?.map((c: any) => ({
    uuid: c.id,
    name: c.name,
  }));

  const proj: Partial<l.ProjectState> = {
    name,
    description: description ?? undefined,
    collections: collectionsList,
    channels,
    credentials,
    options,
    config: config as l.WorkspaceConfig,
  };

  const { id: _ignore, ...restMeta } = meta;
  proj.openfn = {
    // @ts-ignore
    uuid: id,
    ...restMeta,

    inserted_at,
    updated_at,
  };

  if (parent_id) {
    proj.sandbox = {
      parentId: parent_id,
    };
  }

  proj.workflows = Object.values(stateJson.workflows).map((w) =>
    mapWorkflow(w, proj.credentials, config.recordedStepIds)
  );

  return new Project(proj as l.ProjectState, config);
};

// TODO maybe this is a util and moved out of this file
export const mapEdge = (edge: Provisioner.Edge) => {
  const e: any = {
    disabled: !edge.enabled,
  };

  if (edge.condition_type === 'js_expression') {
    e.condition = edge.condition_expression;
  } else if (edge.condition_type) {
    e.condition = edge.condition_type;
  }

  if (edge.condition_label) {
    e.label = edge.condition_label;
  }

  // Do this last so that it serializes last
  if (edge.id) {
    e.openfn = {
      uuid: edge.id,
    };
  }
  return e;
};



// The ids a project on disk has already given its steps, keyed by step name.
// Feed this back into a pull so a step keeps the id it already has.
export const recordedStepIdsOf = (project: any): Record<string, string> => {
  const recorded: Record<string, string> = {};
  for (const workflow of project?.workflows ?? []) {
    for (const step of workflow?.steps ?? []) {
      if (step?.name && step?.id) {
        recorded[step.name] = step.id;
      }
    }
  }
  return recorded;
};

// Work out one id per step, before anything refers to them.
//
// Deriving an id from a name loses whatever is not url-safe, so two names that
// differ only in emoji or accents shorten to the same thing and one step lands
// on top of the other. An id we have already written down is kept. Anything
// new is derived and then made unique, in uuid order, so two people pulling the
// same project separately reach the same answer without talking to each other.
export const resolveStepIds = (
  jobs: Record<string, Provisioner.Job>,
  recorded: Record<string, string> = {}
): Record<string, string> => {
  const byUuid: Record<string, string> = {};
  const taken = new Set<string>();

  const all = Object.values(jobs);

  for (const job of all) {
    const known = recorded[job.name];
    if (known && !taken.has(known)) {
      byUuid[job.id] = known;
      taken.add(known);
    }
  }

  const fresh = all
    .filter((job) => !byUuid[job.id])
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const job of fresh) {
    const base = slugify(job.name) || 'step';
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) {
      candidate = `${base}-${n++}`;
    }
    byUuid[job.id] = candidate;
    taken.add(candidate);
  }

  return byUuid;
};

// map a project workflow to a local cli workflow
// TODO this probably gets easier if I index everything by name
export const mapWorkflow = (
  workflow: Provisioner.Workflow,
  credentials: l.CredentialState[] = [],
  recordedStepIds: Record<string, string> = {}
) => {
  const { jobs, edges, triggers, name, version_history, ...remoteProps } =
    workflow;
  const stepIds = resolveStepIds(jobs, recordedStepIds);
  const mapped: l.WorkflowState = {
    name: workflow.name,
    steps: [],
    history: workflow.version_history ?? [],
    openfn: renameKeys(remoteProps, { id: 'uuid' }),
  };
  if (workflow.name) {
    mapped.id = slugify(workflow.name);
  }

  // TODO what do we do if the condition is disabled?
  // I don't think that's the same as edge condition false?
  Object.values(workflow.triggers).forEach((trigger: Provisioner.Trigger) => {
    const {
      type,
      enabled,
      custom_path,
      cron_expression,
      cron_cursor_job_id,
      webhook_reply,
      webhook_response_config,
      ...otherProps
    } = trigger;
    if (!mapped.start) {
      mapped.start = type;
    }

    const connectedEdges = Object.values(edges).filter(
      (e) => e.source_trigger_id === trigger.id
    );
    mapped.steps.push(
      omitNil({
        id: type,
        type,
        enabled,
        custom_path,
        cron_expression,
        cron_cursor_job_id,
        webhook_reply,
        webhook_response_config,
        openfn: renameKeys(otherProps, { id: 'uuid' }),
        next: connectedEdges.reduce((obj: any, edge) => {
          const target = Object.values(jobs).find(
            (j) => j.id === edge.target_job_id
          );
          if (!target) {
            throw new Error(`Failed to find ${edge.target_job_id}`);
          }
          // we use the name, not the id, to reference
          obj[stepIds[target.id]] = mapEdge(edge);
          return obj;
        }, {}),
      }) as l.Trigger
    );
  });

  Object.values(workflow.jobs).forEach((step: Provisioner.Job) => {
    const outboundEdges = Object.values(edges).filter(
      (e) => e.source_job_id === step.id || e.source_trigger_id === step.id
    );

    const {
      body: expression,
      name,
      adaptor,
      project_credential_id,
      ...remoteProps
    } = step;

    const s: any /*l.Job*/ = {
      id: stepIds[step.id],
      name: name,
      expression,
      adaptor, // TODO is this wrong?
      openfn: renameKeys(remoteProps, { id: 'uuid' }),
    };
    if (project_credential_id) {
      const mappedCredential = credentials.find(
        (c) => c.uuid == project_credential_id
      );
      if (mappedCredential) {
        s.configuration = getCredentialName(mappedCredential);
      } else {
        s.configuration = project_credential_id;
      }
    }

    if (outboundEdges.length) {
      s.next = outboundEdges.reduce((next, edge) => {
        const target = Object.values(jobs).find(
          (j) => j.id === edge.target_job_id
        );
        // @ts-ignore
        next[stepIds[target.id]] = mapEdge(edge);
        return next;
      }, {});
    }
    mapped.steps.push(s);
  });

  return mapped;
};
