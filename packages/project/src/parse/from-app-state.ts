// Load a Project from v1 app state

import * as l from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';

import { Project, Credential } from '../Project';
import renameKeys from '../util/rename-keys';
import slugify from '../util/slugify';
import ensureJson from '../util/ensure-json';
import getCredentialName from '../util/get-credential-name';

export type fromAppStateConfig = Partial<l.WorkspaceConfig> & {
  format?: 'yaml' | 'json';
  alias?: string;
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

  const proj: Partial<l.Project> = {
    name,
    description: description ?? undefined,
    collections,
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
    mapWorkflow(w, proj.credentials)
  );

  return new Project(proj as l.Project, config);
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

// map a project workflow to a local cli workflow
// TODO this probably gets easier if I index everything by name
export const mapWorkflow = (
  workflow: Provisioner.Workflow,
  credentials: Credential[] = []
) => {
  const { jobs, edges, triggers, name, version_history, ...remoteProps } =
    workflow;
  const mapped: l.Workflow = {
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
    const { type, enabled, ...otherProps } = trigger;
    if (!mapped.start) {
      mapped.start = type;
    }

    const connectedEdges = Object.values(edges).filter(
      (e) => e.source_trigger_id === trigger.id
    );
    mapped.steps.push({
      id: type,
      type,
      enabled,
      openfn: renameKeys(otherProps, { id: 'uuid' }),
      next: connectedEdges.reduce((obj: any, edge) => {
        const target = Object.values(jobs).find(
          (j) => j.id === edge.target_job_id
        );
        if (!target) {
          throw new Error(`Failed to find ${edge.target_job_id}`);
        }
        // we use the name, not the id, to reference
        obj[slugify(target.name)] = mapEdge(edge);
        return obj;
      }, {}),
    } as l.Trigger);
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
      id: slugify(name),
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
        next[slugify(target.name)] = mapEdge(edge);
        return next;
      }, {});
    }
    mapped.steps.push(s);
  });

  return mapped;
};
