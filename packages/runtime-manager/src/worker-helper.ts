// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import createLogger from '@openfn/logger';

import * as e from './events';

function publish(event: e.WorkflowEvent) {
  workerpool.workerEmit(event);
}

export const createLoggers = () => {
  const log = (jsonLog: any) => {
    publish({ type: e.JOB_LOG, message: JSON.parse(jsonLog) });
  };

  const emitter = {
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

async function helper(jobId: string, execute: () => Promise<any>) {
  publish({ type: e.WORKFLOW_START, jobId, threadId });
  try {
    // Note that the worker thread may fire logs after completion
    // I think this is fine, it's jsut a log stream thing
    // But the output is very confusing!
    const result = await execute();
    publish({ type: e.WORKFLOW_COMPLETE, jobId, state: result });

    // For tests
    return result;
  } catch (err) {
    console.error(err);
    // @ts-ignore TODO sort out error typing
    publish({ type: e.WORKFLOW_ERROR, jobId, message: err.message });
  }
}

export default helper;
