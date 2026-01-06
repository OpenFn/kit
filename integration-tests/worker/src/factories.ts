import crypto from 'node:crypto';

export const createRun = (triggers, jobs, edges, args = {}) => ({
  id: crypto.randomUUID(),
  triggers,
  jobs,
  edges,
  ...args,
});

export const createJob = (args) => ({
  id: crypto.randomUUID(),
  adaptor: '@openfn/language-common@latest',
  body: 'fn((s) => s)',
  ...args,
});

export const createTrigger = () => ({
  id: crypto.randomUUID(),
});

export const createEdge = (a: any, b: any, extra?: any) => {
  const edge: any = {
    id: crypto.randomUUID(),
    target_job_id: b.id,
  };
  if (!a.body) {
    edge.source_trigger_id = a.id;
  } else {
    edge.source_job_id = a.id;
  }
  Object.assign(edge, extra);
  return edge;
};

export default createRun;
