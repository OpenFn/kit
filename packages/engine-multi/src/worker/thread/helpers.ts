// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import process from 'node:process';

import createLogger, { SanitizePolicies } from '@openfn/logger';

import * as workerEvents from '../events';
import { ExecutionError } from '../../errors';

import { publish } from './runtime';

export const HANDLED_EXIT_CODE = 111111;

export const createLoggers = (
  workflowId: string,
  sanitize?: SanitizePolicies
) => {
  const log = (message: string) => {
    // Apparently the json log stringifies the message
    // We don't really want it to do that
    publish(workerEvents.LOG, {
      workflowId,
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

// Execute wrapper function
export const execute = async (
  workflowId: string,
  executeFn: () => Promise<any>
) => {
  publish(workerEvents.WORKFLOW_START, {
    workflowId,
  });

  const handleError = (err: any) => {
    publish(workerEvents.ERROR, {
      // @ts-ignore
      workflowId,
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
    e.severity = 'crash'; // Downgrade this to a crash because it's likely not our fault
    handleError(e);

    // Close down the process justto be 100% sure that all async code stops
    // This is in a timeout to give the emitted message time to escape
    // There is a TINY WINDOW in which async code can still run and affect the next attempt
    // This should all go away when we replace workerpool
    setTimeout(() => {
      process.exit(HANDLED_EXIT_CODE);
    }, 2);
  });

  try {
    const result = await executeFn();
    publish(workerEvents.WORKFLOW_COMPLETE, { workflowId, state: result });

    // For tests
    return result;
  } catch (err: any) {
    handleError(err);
  }
};
