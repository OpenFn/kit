import crypto from 'node:crypto';
import { get } from 'lodash-es';
import { mapWorkflow } from '../serialize/to-app-state';
import Workflow from '../Workflow';

const SHORT_HASH_LENGTH = 12;

function isDefined(v: any) {
  return v !== undefined && v !== null;
}

export const parse = (version: string) => {
  const [source, hash] = version.split(':');
  return { source, hash };
};

export type HashOptions = {
  source?: string;
  sha?: boolean;
};

export const generateHash = (
  workflow: Workflow,
  { source = 'cli', sha = true }: HashOptions = {}
) => {
  const parts: string[] = [];

  // convert the workflow into a v1 state object
  // this means we can match keys with lightning
  // and everything gets cleaner
  const wfState = mapWorkflow(workflow);

  // These are the keys we hash against
  const wfKeys = ['name', 'positions'].sort();

  // These keys are manually sorted to match lightning equivalents
  const stepKeys = [
    'name',
    'adaptor',
    'keychain_credential_id',
    'project_credential_id',
    'body',
  ].sort();

  const triggerKeys = ['type', 'cron_expression', 'enabled'].sort();

  const edgeKeys = [
    'name', // generated
    'label',
    'condition_type',
    'condition_label',
    'condition_expression',
    'enabled',
  ].sort();

  wfKeys.forEach((key) => {
    const value = get(workflow, key);
    if (isDefined(value)) {
      parts.push(serializeValue(value));
    }
  });

  // do the trigger first
  for (const triggerId in wfState.triggers) {
    const trigger = wfState.triggers[triggerId];
    triggerKeys.forEach((key) => {
      const value = get(trigger, key);
      if (isDefined(value)) {
        parts.push(serializeValue(value));
      }
    });
  }

  // Now do all steps
  const steps = Object.values(wfState.jobs).sort((a, b) => {
    const aName = a.name ?? a.id ?? '';
    const bName = b.name ?? b.id ?? '';
    return aName.toLowerCase().localeCompare(bName.toLowerCase());
  });

  for (const step of steps) {
    stepKeys.forEach((key) => {
      const value = get(step, key);
      if (isDefined(value)) {
        parts.push(serializeValue(value));
      }
    });
  }

  const edges = Object.values(wfState.edges)
    .map((edge) => {
      const sourceId = (edge.source_trigger_id ?? edge.source_job_id) as string;
      const source: any = workflow.get(sourceId);
      const target: any = workflow.get(edge.target_job_id);
      (edge as any).name = `${source.name ?? source.id}-${
        target.name ?? target.id
      }`;
      return edge;
    })
    .sort((a: any, b: any) => {
      // sort edges by name
      // where name is sourcename-target name
      const aName = a.name ?? '';
      const bName = b.name ?? '';
      return aName.localeCompare(bName);
    });

  // now do edges
  for (const edge of edges) {
    edgeKeys.forEach((key) => {
      const value = get(edge, key);
      if (isDefined(value)) {
        parts.push(serializeValue(value));
      }
    });
  }

  const str = parts.join('');
  // console.log(str);
  if (sha) {
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return `${source}:${hash.substring(0, SHORT_HASH_LENGTH)}`;
  } else {
    return `${source}:${str}`;
  }
};

function serializeValue(val: unknown) {
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}
