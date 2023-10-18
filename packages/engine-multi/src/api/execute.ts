// Execute a compiled workflow
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
} from './lifecycle';
import preloadCredentials from './preload-credentials';

const execute = async (context: ExecutionContext) => {
  const { state, callWorker, logger, options } = context;

  const adaptorPaths = await autoinstall(context);
  await compile(context);

  // unfortunately we have to preload all credentials
  // I don't know any way to send data back into the worker once started
  // there is a shared memory thing but I'm not sure how it works yet
  // and not convinced we can use it for two way communication
  if (options.resolvers?.credentials) {
    await preloadCredentials(state.plan as any, options.resolvers?.credentials);
  }

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
    [workerEvents.LOG]: (evt: workerEvents.LogEvent) => {
      log(context, evt);
    },
  };
  return callWorker('run', [state.plan, adaptorPaths], events).catch(
    (e: any) => {
      // TODO what information can I usefully provide here?
      // DO I know which job I'm on?
      // DO I know the thread id?
      // Do I know where the error came from?
      // console.log(' *** EXECUTE ERROR ***');
      // console.log(e);

      error(context, { workflowId: state.plan.id, error: e });

      // If the worker file can't be found, we get:
      // code: MODULE_NOT_FOUND
      // message: cannot find module <path> (worker.js)

      logger.error(e);

      // probbaly have to call complete write now and set the reason
    }
  );
};

export default execute;
