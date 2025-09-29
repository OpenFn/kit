import { timestamp } from '@openfn/logger';

import * as workerEvents from '../worker/events';
import type ExecutionContext from '../classes/ExecutionContext';
import autoinstall from './autoinstall';
import {
  workflowStart,
  workflowComplete,
  log,
  jobStart,
  jobComplete,
  error,
  jobError,
} from './lifecycle';
import preloadCredentials from './preload-credentials';
import { ExecutionError } from '../errors';
import type { RunOptions } from '../worker/thread/run';
import { COMPILE_COMPLETE, COMPILE_START, ExternalEvents } from '../events';

const execute = async (context: ExecutionContext) => {
  const { state, callWorker, logger, options } = context;
  try {
    await autoinstall(context);

    // unfortunately we have to preload all credentials
    // I don't know any way to send data back into the worker once started
    // there is a shared memory thing but I'm not sure how it works yet
    // and not convinced we can use it for two way communication
    if (options.resolvers?.credential) {
      // TODO catch and "throw" nice clean credentials issues
      await preloadCredentials(
        state.plan as any,
        options.resolvers?.credential,
        logger
      );
    }

    // Map any regexes in the whitelist to strings
    const whitelist = options.whitelist?.map((w) => w.toString());

    const runOptions = {
      statePropsToRemove: options.statePropsToRemove,
      whitelist,
      jobLogLevel: options.jobLogLevel,
      repoDir: options.repoDir,
    } as RunOptions;

    const workerOptions = {
      memoryLimitMb: options.memoryLimitMb,
      payloadLimitMb: options.payloadLimitMb,
      timeout: options.runTimeoutMs,
    };

    // Put out a log with the memory limit for the run
    // This is a bit annoying but the log needs to be associated with the run
    // and not just emitted to stdout
    // The runtime can't do it because it doesn't know the memory limit
    if (workerOptions.memoryLimitMb) {
      await log(context, {
        type: workerEvents.LOG,
        workflowId: state.plan.id!,
        threadId: '-', // no thread at this point
        log: {
          level: 'info',
          message: [`Memory limit: ${workerOptions.memoryLimitMb}mb`],
          name: 'RTE',
          time: timestamp().toString(),
        },
      });
    }
    if (workerOptions.timeout) {
      await log(context, {
        type: workerEvents.LOG,
        workflowId: state.plan.id!,
        threadId: '-', // no thread at this point
        log: {
          level: 'info',
          message: [`Timeout: ${workerOptions.timeout / 1000}s`],
          name: 'RTE',
          time: timestamp().toString(),
        },
      });
    }

    const proxy = (name: ExternalEvents, evt: any) => context.emit(name, evt);

    let didError = false;
    const events = {
      [workerEvents.WORKFLOW_START]: (evt: workerEvents.WorkflowStartEvent) => {
        workflowStart(context, evt);
      },
      [workerEvents.WORKFLOW_COMPLETE]: (
        evt: workerEvents.WorkflowCompleteEvent
      ) => {
        workflowComplete(context, evt);
      },
      [workerEvents.JOB_START]: (evt: workerEvents.JobStartEvent) => {
        jobStart(context, evt);
      },
      [workerEvents.JOB_COMPLETE]: (evt: workerEvents.JobCompleteEvent) => {
        jobComplete(context, evt);
      },
      [workerEvents.JOB_ERROR]: (evt: workerEvents.JobErrorEvent) => {
        jobError(context, evt);
      },
      [workerEvents.LOG]: (evt: workerEvents.LogEvent) => {
        log(context, evt);
      },
      [workerEvents.ERROR]: (evt: workerEvents.ErrorEvent) => {
        didError = true;
        error(context, {
          workflowId: state.plan.id,
          error: evt.error,
          threadId: evt.threadId,
        });
      },
      [workerEvents.COMPILE_START]: (evt: workerEvents.CompileStartEvent) =>
        proxy(COMPILE_START, evt),
      [workerEvents.COMPILE_COMPLETE]: (
        evt: workerEvents.CompileCompleteEvent
      ) => proxy(COMPILE_COMPLETE, evt),
    };

    return callWorker(
      'run',
      [state.plan, state.input || {}, runOptions || {}],
      events,
      workerOptions
    ).catch((e: any) => {
      // An error should:
      // a) emit an error event (and so be handled by the error() function
      // b) reject the task in the pool
      // This guard just ensures that error logging is not duplicated
      // if both the above are true (as expected), but that there's still some
      // fallback handling if the error event wasn't issued
      if (!didError) {
        error(context, {
          workflowId: state.plan.id,
          error: e,
          threadId: e.threadId,
        });
        logger.error(`Critical error thrown by ${state.plan.id}`, e);
      }
    });
  } catch (e: any) {
    if (!e.severity) {
      e = new ExecutionError(e);
    }
    error(context, {
      workflowId: state.plan.id,
      error: e,
      threadId: e.threadId,
    });
  }
};

export default execute;
