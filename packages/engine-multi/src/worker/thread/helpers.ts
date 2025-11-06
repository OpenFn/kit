// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock
import process from 'node:process';
import stringify from 'fast-safe-stringify';
import createLogger, { SanitizePolicies } from '@openfn/logger';
import type { JSONLog, LogLevel } from '@openfn/logger';
import type { UUID } from '@openfn/lexicon';

import * as workerEvents from '../events';
import { HANDLED_EXIT_CODE } from '../../events';
import { ExecutionError, ExitError } from '../../errors';
import { publish } from './runtime';
import serializeError from '../../util/serialize-error';

export const createLoggers = (
  workflowId: UUID,
  sanitize: SanitizePolicies = 'none',
  publish?: any,
  jobLogLevel: LogLevel = 'debug'
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
    level: jobLogLevel,
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

type Options = {
  /**
   * Should we return results directly?
   * Useful for tests but dangerous in production
   * as can cause OOM errors for large results
   * */
  directReturn?: boolean;

  /**
   * Allow a custom publish function to be passed in
   */
  publish?: typeof publish;
};

// Execute wrapper function
export const execute = async (
  workflowId: string,
  executeFn: () => Promise<any> | undefined,
  options: Options = {}
) => {
  const publishFn = options.publish ?? publish;

  const handleError = (err: any) => {
    publishFn(workerEvents.ERROR, {
      // @ts-ignore
      workflowId,
      // Map the error out of the thread in a serializable format
      error: serializeError(err),
      stack: err?.stack,
      // TODO job id maybe
    });

    // Explicitly send a reject task error, to ensure the worker closes down
    publish(workerEvents.ENGINE_REJECT_TASK, {
      error: serializeError(err),
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
    // Log this error to local stdout. This won't be sent out of the worker thread.
    console.debug(
      `Uncaught exception in worker thread (workflow ${workflowId} )`
    );
    console.debug(err);

    // Also try and log to the workflow's logger
    try {
      console.error(
        `Uncaught exception in worker thread (workflow ${workflowId} )`
      );
      console.error(err);
    } catch (e) {
      console.error(`Uncaught exception in worker thread`);
    }

    // For now, we'll write this off as a crash-level generic execution error
    // TODO did this come from job or adaptor code?
    const e = new ExecutionError(err);
    e.severity = 'crash'; // Downgrade this to a crash because it's likely not our fault
    handleError(e);
  });

  publishFn(workerEvents.WORKFLOW_START, {
    workflowId,
  });

  try {
    const result = await executeFn();
    publishFn(workerEvents.WORKFLOW_COMPLETE, { workflowId, state: result });

    return options.directReturn ? result : {};
  } catch (err: any) {
    handleError(err);
  }
};
