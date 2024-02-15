import { ExecutionPlan, Job } from '@openfn/lexicon';
import { Edge, Node } from '@openfn/lexicon/lightning';
import crypto from 'node:crypto';

export const wait = (fn: () => any, maxRuns = 100) =>
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

export const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

export const waitForEvent = <T>(engine: any, eventName: string) =>
  new Promise<T>((resolve) => {
    engine.once(eventName, (e: any) => {
      resolve(e);
    });
  });

export const sleep = (delay = 100) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay);
  });

export const createPlan = (...steps: Job[]) =>
  ({
    id: crypto.randomUUID(),
    workflow: {
      steps,
    },
    options: {},
  } as ExecutionPlan);

export const createEdge = (from: string, to: string) =>
  ({
    id: `${from}-${to}`,
    source_job_id: from,
    target_job_id: to,
  } as Edge);

export const createJob = (body?: string, id?: string) =>
  ({
    id: id || crypto.randomUUID(),
    body: body || `fn((s) => s)`,
  } as Node);

export const createRun = (jobs = [], edges = [], triggers = []) => ({
  id: crypto.randomUUID(),
  jobs,
  edges,
  triggers,
});
