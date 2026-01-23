import { ConditionalStepEdge, Job, Trigger, Workflow } from '@openfn/lexicon';
import crypto from 'node:crypto';
import { get } from 'lodash-es';

const SHORT_HASH_LENGTH = 12;

function isDefined(v: any) {
  return v !== undefined && v !== null;
}

export const parse = (version: string) => {
  const [source, hash] = version.split(':');
  return { source, hash };
};

export const generateHash = (workflow: Workflow, source = 'cli') => {
  const parts: string[] = [];

  // These are the keys we hash against
  const wfKeys = ['name', 'positions'].sort() as Array<keyof Workflow>;
  const stepKeys = [
    'name',
    'adaptors',
    'adaptor', // there's both adaptor & adaptors key in steps somehow
    'openfn.keychain_credential_id', // TODO?
    'configuration', // assumes a string credential id
    'expression',

    // trigger keys
    'type',
    'openfn.cron_expression',
    'openfn.enabled',
  ].sort() as Array<keyof Job | keyof Trigger>;
  const edgeKeys = [
    'condition',
    'label',
    'disabled', // This feels more like an option - should be excluded?
  ].sort();

  wfKeys.forEach((key) => {
    const value = get(workflow, key);
    if (isDefined(value)) {
      parts.push(serializeValue(value));
    }
  });

  const steps = (workflow.steps || []).slice().sort((a, b) => {
    const aName = a.name ?? '';
    const bName = b.name ?? '';
    return aName.localeCompare(bName);
  });

  for (const step of steps) {
    stepKeys.forEach((key) => {
      const value = get(step, key);
      if (isDefined(value)) {
        parts.push(serializeValue(value));
      }
    });

    const sortedEdges = Object.keys(step.next ?? {}).sort(
      (a: ConditionalStepEdge, b: ConditionalStepEdge) => {
        const aLabel = a.label || '';
        const bLabel = b.label || '';
        return aLabel.localeCompare(bLabel);
      }
    );
    for (const edgeId of sortedEdges) {
      const edge = step.next[edgeId];
      edgeKeys.forEach((key) => {
        const value = get(edge, key);
        if (isDefined(value)) {
          parts.push(serializeValue(value));
        }
      });
    }
  }

  const str = parts.join('');
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return `${source}:${hash.substring(0, SHORT_HASH_LENGTH)}`;
};

function serializeValue(val: unknown) {
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}
