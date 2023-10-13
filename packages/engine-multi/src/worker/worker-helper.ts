// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import createLogger from '@openfn/logger';

import * as e from '../events';

function publish(event: e.WorkflowEvent) {
  workerpool.workerEmit(event);
}

export const createLoggers = (workflowId: string) => {
  const log = (message: string) => {
    // hmm, the json log stringifies the message
    // i don't really want it to do that
    workerpool.workerEmit({
      workflowId,
      type: e.WORKFLOW_LOG,
      message: JSON.parse(message),
    });
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

// TODO use bespoke event names here
// maybe thread:workflow-start
async function helper(workflowId: string, execute: () => Promise<any>) {
  function publish(type: string, payload: any = {}) {
    workerpool.workerEmit({
      workflowId,
      threadId,
      type,
      ...payload,
    } as e.WorkflowEvent);
  }

  publish(e.WORKFLOW_START);
  try {
    // Note that the worker thread may fire logs after completion
    // I think this is fine, it's just a log stream thing
    // But the output is very confusing!
    const result = await execute();
    publish(e.WORKFLOW_COMPLETE, { state: result });

    // For tests
    return result;
  } catch (err) {
    console.error(err);
    // @ts-ignore TODO sort out error typing
    publish(e.WORKFLOW_ERROR, { message: err.message });
  }
}

export default helper;
