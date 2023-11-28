// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import createLogger, { SanitizePolicies } from '@openfn/logger';

import * as workerEvents from './events';
import { ExecutionError } from '../errors';

export const createLoggers = (
  workflowId: string,
  sanitize?: SanitizePolicies
) => {
  const log = (message: string) => {
    // Apparently the json log stringifies the message
    // We don't really want it to do that
    workerpool.workerEmit({
      workflowId,
      type: workerEvents.LOG,
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

export function publish<T extends workerEvents.WorkerEvents>(
  workflowId: string,
  type: T,
  payload: Omit<workerEvents.EventMap[T], 'type' | 'workflowId' | 'threadId'>
) {
  workerpool.workerEmit({
    workflowId,
    threadId,
    type,
    ...payload,
  });
}

async function helper(workflowId: string, execute: () => Promise<any>) {
  publish(workflowId, workerEvents.WORKFLOW_START, {});

  const handleError = (err: any) => {
    publish(workflowId, workerEvents.ERROR, {
      // @ts-ignore
      workflowId,
      threadId,

      // Map the error out of the thread in a serializable format
      error: {
        message: err.message,
        type: err.subtype || err.type || err.name,
        severity: err.severity || 'crash',
      },
      // TODO job id maybe
    });
  };

  // catch-all for any uncaught errors, which likely come from asynchronous code
  // (probably in an adaptor)
  // Note that if this occurs after the execute promise resolved,
  // it'll be ignored (ie the workerEmit call will fail)
  process.on('uncaughtException', async (err: any) => {
    // For now, we'll write this off as a crash-level generic execution error
    // TODO did this come from job or adaptor code?
    const e = new ExecutionError(err);
    e.severity = 'crash'; // Downgrade this to a crash becuase it's likely not our fault
    handleError(e);
    process.exit(1);
  });

  try {
    // Note that the worker thread may fire logs after completion
    // I think this is fine, it's just a log stream thing
    // But the output is very confusing!
    const result = await execute();
    publish(workflowId, workerEvents.WORKFLOW_COMPLETE, { state: result });

    // For tests
    return result;
  } catch (err: any) {
    handleError(err);
  }
}

export default helper;
