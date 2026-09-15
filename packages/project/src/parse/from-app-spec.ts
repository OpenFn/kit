// Convert a v1 spec (as exported from the Lightning app) into the v2 spec
// shape, so it can be loaded by the regular v2 parser
//
// A v1 spec has v1's keyed-object structure but, unlike v1 state, carries no
// uuids at all - workflows, jobs, triggers and credentials are all
// cross-referenced by their key in the owning map. serialize/to-app-spec is
// the inverse

import * as l from '@openfn/lexicon';

import slugify from '../util/slugify';
import omitNil from '../util/omit-nil';
import getCredentialName from '../util/get-credential-name';

// v1 state always carries a `project_credentials` array; a spec instead uses a
// name-keyed `credentials` map, and refers to steps by name rather than uuid
export const isAppSpec = (json: any): boolean => {
  if (!json || Array.isArray(json.project_credentials)) {
    return false;
  }
  if (json.credentials && !Array.isArray(json.credentials)) {
    return true;
  }
  return Object.values(json.workflows ?? {}).some((wf: any) =>
    Object.values(wf?.edges ?? {}).some(
      (e: any) => e && (e.source_job || e.source_trigger || e.target_job)
    )
  );
};

const mapCondition = (edge: any) => {
  if (edge.condition_type === 'js_expression') {
    return edge.condition_expression;
  }
  return edge.condition_type;
};

const mapWorkflow = (
  key: string,
  workflow: any,
  credentialNames: Record<string, string>
) => {
  const steps: any[] = [];

  // edges reference steps by their key in the jobs/triggers map, so track
  // what each key becomes
  const stepIds: Record<string, string> = {};
  const byId: Record<string, any> = {};

  const addStep = (mapKey: string, step: any) => {
    stepIds[mapKey] = step.id;
    byId[step.id] = step;
    steps.push(step);
  };

  for (const [triggerKey, trigger] of Object.entries(
    workflow.triggers ?? {}
  ) as [string, any][]) {
    // a trigger's id is its type, matching how v2 specs are written
    addStep(triggerKey, omitNil({ ...trigger, id: trigger.type }));
  }

  for (const [jobKey, job] of Object.entries(workflow.jobs ?? {}) as [
    string,
    any
  ][]) {
    const { name, body, adaptor, credential, ...rest } = job;
    addStep(
      jobKey,
      omitNil({
        ...rest,
        id: slugify(name ?? jobKey),
        name,
        expression: body,
        adaptor,
        configuration: credential
          ? credentialNames[credential] ?? credential
          : undefined,
      })
    );
  }

  // v2 hangs each edge off its source step, keyed by the target's id
  for (const edge of Object.values(workflow.edges ?? {}) as any[]) {
    const source = byId[stepIds[edge.source_trigger ?? edge.source_job]];
    const target = stepIds[edge.target_job];
    if (!source || !target) {
      continue;
    }
    source.next ??= {};
    source.next[target] = omitNil({
      condition: mapCondition(edge),
      disabled: !edge.enabled,
      label: edge.condition_label,
    });
  }

  const [firstTrigger] = Object.values(workflow.triggers ?? {}) as any[];

  return omitNil({
    id: slugify(workflow.name ?? key),
    name: workflow.name,
    start: firstTrigger?.type,
    steps,
  });
};

export default (json: any): l.ProjectState => {
  const credentials = Object.values(json.credentials ?? {}).map((c: any) => ({
    name: c.name,
    owner: c.owner,
  }));

  // jobs name a credential by its key in the credentials map, but v2 refers to
  // credentials as `owner|name`
  const credentialNames: Record<string, string> = {};
  for (const [key, c] of Object.entries(json.credentials ?? {}) as [
    string,
    any
  ][]) {
    credentialNames[key] = getCredentialName(c);
  }

  const workflows = Object.entries(json.workflows ?? {}).map(([key, wf]) =>
    mapWorkflow(key, wf, credentialNames)
  );

  return omitNil({
    ...json,
    schema_version: '4.0',
    credentials,
    workflows,
  }) as l.ProjectState;
};
