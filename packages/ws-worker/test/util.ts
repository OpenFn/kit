import { ExecutionPlan } from '@openfn/runtime';
import crypto from 'node:crypto';

export const wait = (fn, maxRuns = 100) =>
  new Promise<any>((resolve) => {
    let count = 0;
    let ival = setInterval(() => {
      count++;
      const result = fn() || true;
      if (result) {
        clearInterval(ival);
        resolve(result);
      }

      if (count == maxRuns) {
        clearInterval(ival);
        resolve(null);
      }
    }, 100);
  });

export const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const waitForEvent = <T>(engine, eventName) =>
  new Promise<T>((resolve) => {
    engine.once(eventName, (e) => {
      resolve(e);
    });
  });

export const sleep = (delay = 100) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay);
  });

export const createPlan = (...jobs) =>
  ({
    id: crypto.randomUUID(),
    jobs: [...jobs],
  } as ExecutionPlan);

export const createEdge = (from: string, to: string) => ({
  id: `${from}-${to}`,
  source_job_id: from,
  target_job_id: to,
});

export const createJob = (body?: string, id?: string) => ({
  id: id || crypto.randomUUID(),
  body: body || `fn((s) => s)`,
});

export const createRun = (jobs = [], edges = [], triggers = []) => ({
  id: crypto.randomUUID(),
  jobs,
  edges,
  triggers,
});
