import crypto from 'node:crypto';

const SHORT_HASH_LENGTH = 12;

export const project = () => {};

export const workflow = (workflow: l.Workflow, source = 'cli') => {
  const parts = [];

  // These are the keys we hash against
  const wfkeys = ['name', 'credentials'].sort();
  const stepKeys = [
    'name',
    'adaptors',
    'expression',
    'configuration', // assumes a string credential id
    'expression',

    // TODO need to model trigger types in this, which I think are currently ignored
  ].sort();
  const edgeKeys = [
    'condition',
    'label',
    'disabled', // This feels more like an option - should be excluded?
  ].sort();

  for (const step of workflow.steps) {
    stepKeys.forEach((key) => {
      if (typeof step[key] === 'string') {
        parts.push(key, step[key]);
      }
    });

    // if (step.next) {
    //   for (const edge of step.next) {
    //     // TODO I don't think we can handle this well right now
    //   }
    // }
  }

  const str = parts.join('');
  const hash = crypto.hash('sha256', str);

  return `${source}:${hash.substr(0, 12)}`;
};
