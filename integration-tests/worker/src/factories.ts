import crypto from 'node:crypto';

export const createAttempt = (jobs, edges, args) => ({
  id: crypto.randomUUID(),
  jobs,
  edges,
  ...args,
});

export const createJob = (args) => ({
  id: crypto.randomUUID(),
  adaptor: '@openfn/language-common@latest',
  expression: 'fn((s) => s)',
  ...args,
});

export const createEdge = (a: any, b: any, condition?: string) => ({
  id: crypto.randomUUID(),
  source_job_id: a.id,
  target_job_id: b.id,
  // condition,
});

export default createAttempt;
