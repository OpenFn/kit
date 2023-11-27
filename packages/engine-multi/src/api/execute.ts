// Execute a compiled workflow
import { Promise as WorkerPoolPromise } from 'workerpool';

import * as workerEvents from '../worker/events';
import { ExecutionContext } from '../types';

import autoinstall from './autoinstall';
import compile from './compile';
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
import { ExecutionError, OOMError, TimeoutError } from '../errors';

const execute = async (context: ExecutionContext) => {
  const { state, callWorker, logger, options } = context;
  try {
    // TODO catch and "throw" nice clean autoinstall errors
    const adaptorPaths = await autoinstall(context);

    // TODO catch and "throw" nice clean compile errors
    try {
      await compile(context);
    } catch (e: any) {
      if (e.type === 'CompileError') {
        return error(context, { workflowId: state.plan.id, error: e });
      }
      throw e;
    }

    // unfortunately we have to preload all credentials
    // I don't know any way to send data back into the worker once started
    // there is a shared memory thing but I'm not sure how it works yet
    // and not convinced we can use it for two way communication
    if (options.resolvers?.credential) {
      // TODO catch and "throw" nice clean credentials issues
      await preloadCredentials(
        state.plan as any,
        options.resolvers?.credential
      );
    }

    const runOptions = {
      adaptorPaths,
      whitelist: options.whitelist,
    };

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
      // TODO this is also untested
      [workerEvents.ERROR]: (evt: workerEvents.ErrorEvent) => {
        error(context, { workflowId: state.plan.id, error: evt.error });
      },
    };
    return callWorker(
      'run',
      [state.plan, runOptions],
      events,
      options.timeout
    ).catch((e: any) => {
      // An error here is basically a crash state
      if (e.code === 'ERR_WORKER_OUT_OF_MEMORY') {
        e = new OOMError();
      } else if (e instanceof WorkerPoolPromise.TimeoutError) {
        // Map the workerpool error to our own
        e = new TimeoutError(options.timeout!);
      }

      // TODO: map anything else to an executionError

      // TODO what information can I usefully provide here?
      // DO I know which job I'm on?
      // DO I know the thread id?
      // Do I know where the error came from?
      error(context, { workflowId: state.plan.id, error: e });
      logger.error(e);
    });
  } catch (e: any) {
    if (!e.severity) {
      e = new ExecutionError(e);
    }
    error(context, { workflowId: state.plan.id, error: e });
  }
};

export default execute;
