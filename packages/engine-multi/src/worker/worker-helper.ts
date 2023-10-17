// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import createLogger from '@openfn/logger';

import * as workerEvents from './events';

export const createLoggers = (workflowId: string) => {
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
  });
  const jobLogger = createLogger('JOB', {
    logger: emitter,
    level: 'debug',
    json: true,
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

// TODO use bespoke event names here
// maybe thread:workflow-start
async function helper(workflowId: string, execute: () => Promise<any>) {
  publish(workflowId, workerEvents.WORKFLOW_START, {});

  try {
    // Note that the worker thread may fire logs after completion
    // I think this is fine, it's just a log stream thing
    // But the output is very confusing!
    const result = await execute();
    publish(workflowId, workerEvents.WORKFLOW_COMPLETE, { state: result });

    // For tests
    return result;
  } catch (err: any) {
    console.error(err);
    publish(workflowId, workerEvents.ERROR, {
      workflowId,
      threadId,
      message: err.message,
    });
  }
}

export default helper;
