// Execute a compiled workflow
import * as e from '../events';
import { ExecutionContext } from '../types';

import autoinstall from './autoinstall';
import compile from './compile';
import { workflowStart, workflowComplete, log } from './lifecycle';

// A lot of callbacks needed here
// Is it better to just return the handler?
// But then this function really isn't doing so much
// (I guess that's true anyway)
const execute = async (context: ExecutionContext) => {
  const { state, callWorker, logger } = context;

  const adaptorPaths = await autoinstall(context);
  await compile(context);

  const events = {
    [e.WORKFLOW_START]: (evt) => {
      workflowStart(context, evt);
    },
    [e.WORKFLOW_COMPLETE]: (evt) => {
      workflowComplete(context, evt);
    },
    [e.WORKFLOW_LOG]: (evt) => {
      log(context, evt);
    },
  };

  return callWorker('run', [state.plan, adaptorPaths], events).catch((e) => {
    // TODO what about errors then?
    logger.error(e);
  });
};

export default execute;
