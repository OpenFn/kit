import { ExecutionPlan, Job } from '@openfn/lexicon';
import * as Sentry from '@sentry/node';
import sentryTestkit from 'sentry-testkit';
import {
  LightningEdge,
  LightningNode,
  LightningPlan,
} from '@openfn/lexicon/lightning';
import crypto from 'node:crypto';

export const initSentry = () => {
  const { testkit, sentryTransport } = sentryTestkit();
  Sentry.init({
    dsn: 'https://296274784378f87245c369278a62b29a@o55451.ingest.us.sentry.io/4508936084848640',
    transport: sentryTransport,
  });
  return testkit;
};

// Telemetry will asynchronously submit the report in the background
// We have to wait for it here in this nasty loop :(
export const waitForSentryReport = async (testkit: any, max = 500) => {
  for (let i = 0; i < max; i++) {
    if (i >= max) {
      throw new Error('SENTRY_REPORT_TIMEOUT');
    }
    const reports = testkit.reports();
    if (reports.length) {
      return reports;
    }
    await sleep(1);
  }
};

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

export const createPlan = (...steps: Partial<Job>[]) =>
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
  } as LightningEdge);

export const createJob = (body?: string, id?: string) =>
  ({
    id: id || crypto.randomUUID(),
    body: body || `fn((s) => s)`,
  } as LightningNode);

export const createRun = (jobs = [], edges = [], triggers = []) =>
  ({
    id: crypto.randomUUID(),
    jobs,
    edges,
    triggers,
  } as unknown as LightningPlan);
