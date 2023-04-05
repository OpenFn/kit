import { ExecutionPlan } from '../types';

type ModelNode = {
  up: Record<string, true>;
  down: Record<string, true>;
};

type Model = {
  [nodeId: string]: ModelNode;
};

export default (plan: ExecutionPlan) => {
  const model = buildModel(plan);

  assertNoCircularReferences(model);
  assertSingletonDependencies(model);

  return true;
};

export const buildModel = (plan: ExecutionPlan) => {
  const model: Model = {};
  const ensureModel = (jobId: string) => {
    if (!plan.jobs[jobId]) {
      throw new Error(`Cannot find job: ${jobId}`);
    }
    if (!model[jobId]) {
      model[jobId] = {
        up: {}, // ancestors / dependencies
        down: {}, // next / descendents
      };
    }
    return model[jobId];
  };

  for (const jobId in plan.jobs) {
    const job = plan.jobs[jobId];
    const node = ensureModel(jobId);

    for (const nextId in job.next) {
      node.down[nextId] = true;

      const nextNode = ensureModel(nextId);
      nextNode.up[jobId] = true;
    }
  }
  return model;
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
        throw new Error(`Circular dependency: ${from} <-> ${targetId}`);
      }
      search(nextId, targetId, key);
    }
  };
  for (const id in model) {
    search(id, id, 'down');
    search(id, id, 'up'); // TODO do we even need to do this?
  }
};

const assertSingletonDependencies = (model: Model) => {
  for (const id in model) {
    const node = model[id];
    if (Object.keys(node.up).length > 1) {
      throw new Error(`Multiple dependencies detected for: ${id}`);
    }
  }
};
