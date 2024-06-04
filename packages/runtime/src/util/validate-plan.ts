import { ExecutionPlan, Step } from '@openfn/lexicon';
import { ValidationError } from '../errors';

type ModelNode = {
  up: Record<string, true>;
  down: Record<string, true>;
};

type Model = {
  [nodeId: string]: ModelNode;
};

export default (plan: ExecutionPlan) => {
  assertStart(plan);

  const model = buildModel(plan);
  assertNoCircularReferences(model);

  return true;
};

export const buildModel = ({ workflow }: ExecutionPlan) => {
  const model: Model = {};

  const jobIdx = workflow.steps.reduce((obj, item) => {
    if (item.id) {
      obj[item.id] = item;
    }
    // TODO warn if there's no id? It's usually fine (until it isn't)
    return obj;
  }, {} as Record<string, Step>);

  const ensureModel = (jobId: string) => {
    if (!model[jobId]) {
      model[jobId] = {
        up: {}, // ancestors / dependencies
        down: {}, // next / descendents
      };
    }
    return model[jobId];
  };

  const validateJob = (jobId: string) => {
    const next = jobIdx[jobId];
    if (!next) {
      throw new ValidationError(`Cannot find job: ${jobId}`);
    }
  };

  for (const job of workflow.steps) {
    let node = job.id ? ensureModel(job.id) : { up: {}, down: {} };
    if (typeof job.next === 'string') {
      validateJob(job.next);
    } else {
      for (const nextId in job.next) {
        validateJob(nextId);

        node.down[nextId] = true;

        const nextNode = ensureModel(nextId);
        if (job.id) {
          // TODO is this a big problem if a node is downstream of a node with no id?
          // Probably not, as there's no way to loop back to it
          nextNode.up[job.id] = true;
        }
      }
    }
  }
  return model;
};

const assertStart = (plan: ExecutionPlan) => {
  const { start } = plan.options;
  if (typeof start === 'string') {
    if (!plan.workflow.steps.find(({ id }) => id === start)) {
      throw new ValidationError(`Could not find start job: ${start}`);
    }
  }
};

// TODO this can be improved by reporting ALL circular references
// But that's out of scope for now
const assertNoCircularReferences = (model: Model) => {
  // Search the model for the same key in either direction
  const search = (
    from: keyof Model,
    targetId: keyof Model,
    key: 'up' | 'down'
  ) => {
    const node = model[from];
    const stream = node[key];
    for (const nextId in stream) {
      if (nextId === targetId) {
        throw new ValidationError(
          `Circular dependency: ${from} <-> ${targetId}`
        );
      }
      search(nextId, targetId, key);
    }
  };
  for (const id in model) {
    search(id, id, 'down');
    search(id, id, 'up'); // TODO do we even need to do this?
  }
};
