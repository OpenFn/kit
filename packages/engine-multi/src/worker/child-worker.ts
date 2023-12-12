import process from 'node:process';
import createLogger, { SanitizePolicies } from '@openfn/logger';
import execute, { NotifyEvents } from '@openfn/runtime';

import * as workerEvents from './events';

console.log('hello from inside the child', process.pid);
// This is what runs inside the node child processs

// Pull the run arguments from the incoming command
const [_cmd, _module, p, o] = process.argv;
const plan = JSON.parse(p);
const options = JSON.parse(o || '{}');

const workflowId = plan.id;
const threadId = process.pid;

export function publish<T extends workerEvents.WorkerEvents>(
  type: T,
  payload: Omit<workerEvents.EventMap[T], 'type' | 'workflowId' | 'threadId'>
) {
  process.send?.({
    workflowId,
    threadId,
    type,
    ...payload,
  });
}

export const createLoggers = (sanitize?: SanitizePolicies) => {
  const log = (message: string) => {
    publish(workerEvents.LOG, {
      // Apparently the json log stringifies the message
      // We don't really want it to do that
      message: JSON.parse(message),
    } as workerEvents.LogEvent);
  };

  const emitter: any = {
    info: log,
    debug: log,
    log,
    warn: log,
    error: log,
    success: log,
    always: log,
  };

  const logger = createLogger('R/T', {
    logger: emitter,
    level: 'debug',
    json: true,
    sanitize,
  });
  const jobLogger = createLogger('JOB', {
    logger: emitter,
    level: 'debug',
    json: true,
    sanitize,
  });

  return { logger, jobLogger };
};

// TODO there's no error handling at all here
async function run() {
  const { adaptorPaths, whitelist, sanitize } = options;
  const { logger, jobLogger } = createLoggers(sanitize);
  const opts = {
    strict: false,
    logger,
    jobLogger,
    linker: {
      modules: adaptorPaths,
      whitelist,
      cacheKey: plan.id,
    },
    callbacks: {
      // TODO: this won't actually work across the worker boundary
      // For now I am preloading credentials
      // resolveCredential: async (id: string) => {},
      notify: (name: NotifyEvents, payload: any) => {
        // convert runtime notify events to internal engine events
        publish(`worker:${name}`, payload);
      },
    },
  };

  publish(workerEvents.WORKFLOW_START, {});

  const result = await execute(plan, undefined, opts);

  publish(workerEvents.WORKFLOW_COMPLETE, { state: result });
}

run();
