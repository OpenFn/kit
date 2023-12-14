// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import process from 'node:process';

import createLogger, { SanitizePolicies } from '@openfn/logger';

import * as workerEvents from './events';
import { ExecutionError } from '../errors';

type TaskRegistry = Record<string, (...args: any[]) => Promise<any>>;

type WorkerEvent = {
  type: string;

  [key: string]: any;
};

const threadId = process.pid;

const tasks: TaskRegistry = {
  // startup validation script
  handshake: async () => true,
};

export const register = (newTasks: TaskRegistry) => {
  Object.assign(tasks, newTasks);
};

process.on('message', async (evt: WorkerEvent) => {
  if (evt.type === 'engine:run_task') {
    const args = evt.args || [];
    run(evt.task, args);
  }
});

const run = (task: string, args: any[] = []) => {
  if (!tasks[task]) {
    return process.send?.({
      type: 'engine:reject_task',
      error: {
        severity: 'exception',
        message: `task ${task} not found`,
        type: 'TaskNotFoundError',
      },
    });
  }

  tasks[task](...args)
    .then((result) => {
      process.send?.({
        type: 'engine:resolve_task',
        result,
      });
    })
    .catch((e) => {
      process.send?.({
        type: 'engine:reject_task',
        error: {
          severity: e.severity || 'crash',
          message: e.message,
          type: e.type || e.name,
        },
      });
    });
};

export const createLoggers = (
  workflowId: string,
  sanitize?: SanitizePolicies
) => {
  const log = (message: string) => {
    // Apparently the json log stringifies the message
    // We don't really want it to do that
    publish(workflowId, workerEvents.LOG, {
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
  const event = {
    workflowId,
    threadId,
    type,
    ...payload,
  };
  return new Promise<void>((resolve) => {
    process.send?.(event, undefined, {}, () => {
      resolve();
    });
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
    e.severity = 'crash'; // Downgrade this to a crash because it's likely not our fault
    handleError(e);

    // Close down the process justto be 100% sure that all async code stops
    // This is in a timeout to give the emitted message time to escape
    // There is a TINY WINDOW in which async code can still run and affect the next attempt
    // This should all go away when we replace workerpool
    setTimeout(() => {
      process.exit(111111);
    }, 2);
  });

  try {
    const result = await execute();
    publish(workflowId, workerEvents.WORKFLOW_COMPLETE, { state: result });

    // For tests
    return result;
  } catch (err: any) {
    handleError(err);
  }
}

export default helper;
