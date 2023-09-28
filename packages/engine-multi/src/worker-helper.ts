// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import createLogger, { JSONLog } from '@openfn/logger';

import * as e from './events';

function publish(event: e.WorkflowEvent) {
  workerpool.workerEmit(event);
}

export const createLoggers = (workflowId: string) => {
  const log = (jsonLog: string) => {
    publish({
      workflowId,
      type: e.WORKFLOW_LOG,
      message: JSON.parse(jsonLog) as JSONLog,
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

async function helper(workflowId: string, execute: () => Promise<any>) {
  publish({ type: e.WORKFLOW_START, workflowId, threadId });
  try {
    // Note that the worker thread may fire logs after completion
    // I think this is fine, it's just a log stream thing
    // But the output is very confusing!
    const result = await execute();
    publish({ type: e.WORKFLOW_COMPLETE, workflowId, state: result });

    // For tests
    return result;
  } catch (err) {
    console.error(err);
    // @ts-ignore TODO sort out error typing
    publish({ type: e.WORKFLOW_ERROR, workflowId, message: err.message });
  }
}

export default helper;
