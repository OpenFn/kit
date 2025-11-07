import { ConditionalStepEdge, Job, Trigger, Workflow } from '@openfn/lexicon';
import crypto from 'node:crypto';

const SHORT_HASH_LENGTH = 12;

export const project = () => {};

function isDefined(v: any) {
  return v !== undefined && v !== null;
}

export const generateHash = (workflow: Workflow, source = 'cli') => {
  const parts: string[] = [];

  // These are the keys we hash against
  const wfKeys = ['name', 'credentials'].sort() as Array<keyof Workflow>;
  const stepKeys = [
    'name',
    'adaptors',
    'adaptor', // there's both adaptor & adaptors key in steps somehow
    'expression',
    'configuration', // assumes a string credential id
    'expression',

    // TODO need to model trigger types in this, which I think are currently ignored
  ].sort() as Array<keyof Job | keyof Trigger>;
  const edgeKeys = [
    'condition',
    'label',
    'disabled', // This feels more like an option - should be excluded?
  ].sort();

  wfKeys.forEach((key) => {
    if (isDefined(workflow[key])) {
      parts.push(key, serializeValue(workflow[key]));
    }
  });

  const steps = (workflow.steps || []).slice().sort((a, b) => {
    const aName = a.name ?? '';
    const bName = b.name ?? '';
    return aName.localeCompare(bName);
  });
  for (const step of steps) {
    stepKeys.forEach((key) => {
      if (isDefined((step as any)[key])) {
        parts.push(key, serializeValue((step as any)[key]));
      }
    });

    if (step.next && Array.isArray(step.next)) {
      const steps = step.next.slice() as Array<ConditionalStepEdge>;
      steps.slice().sort((a: ConditionalStepEdge, b: ConditionalStepEdge) => {
        const aLabel = a.label || '';
        const bLabel = b.label || '';
        return aLabel.localeCompare(bLabel);
      });
      for (const edge of step.next) {
        edgeKeys.forEach((key) => {
          if (isDefined(edge[key])) {
            parts.push(key, serializeValue(edge[key]));
          }
        });
      }
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
