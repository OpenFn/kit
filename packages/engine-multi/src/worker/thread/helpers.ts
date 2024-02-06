// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import process from 'node:process';
import stringify from 'fast-safe-stringify';
import createLogger, { SanitizePolicies } from '@openfn/logger';
import type { JSONLog } from '@openfn/logger';

import * as workerEvents from '../events';
import { HANDLED_EXIT_CODE } from '../../events';
import { ExecutionError, ExitError } from '../../errors';
import { publish } from './runtime';
import serializeError from '../../util/serialize-error';

export const createLoggers = (
  workflowId: string,
  sanitize: SanitizePolicies = 'none',
  publish?: any
) => {
  const log = (message: JSONLog) => {
    publish(workerEvents.LOG, {
      workflowId,
      log: {
        ...message,
        // stringify the message now so that we know it's safe
        // this also makes it more performant to feed up to the worker
        message: stringify(message.message),
      },
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

  const adaptorLogger = createLogger('ADA', {
    logger: emitter,
    level: 'debug',
    json: true,
    sanitize,
  });

  return { logger, jobLogger, adaptorLogger };
};

// Execute wrapper function
export const execute = async (
  workflowId: string,
  executeFn: () => Promise<any>
) => {
  const handleError = (err: any) => {
    publish(workerEvents.ERROR, {
      // @ts-ignore
      workflowId,
      // Map the error out of the thread in a serializable format
      error: serializeError(err),
      // TODO job id maybe
    });
  };

  process.on('exit', (code: number) => {
    if (code !== HANDLED_EXIT_CODE) {
      handleError(new ExitError(code));
    }
  });

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

    // Close down the process just to be 100% sure that all async code stops
    // This is in a timeout to give the emitted message time to escape
    // There is a TINY WINDOW in which async code can still run and affect the next run
    // This should all go away when we replace workerpool
    setTimeout(() => {
      process.exit(HANDLED_EXIT_CODE);
    }, 2);
  });

  publish(workerEvents.WORKFLOW_START, {
    workflowId,
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
