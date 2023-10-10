// this replaces the runner

// Execute a compiled workflow
import * as e from '../events';
import { EngineAPI, WorkflowState } from '../types';

import autoinstall from './autoinstall';
import compile from './compile';
import { workflowStart, workflowComplete, log } from './lifecycle';

// A lot of callbacks needed here
// Is it better to just return the handler?
// But then this function really isn't doing so much
// (I guess that's true anyway)
const execute = async (
  api: EngineAPI,
  state: WorkflowState,
  options: RTEOptions
) => {
  const adaptorPaths = await autoinstall(api, state, options.autoinstall);
  await compile(api, state, options);

  const events = {
    [e.WORKFLOW_START]: (evt) => {
      workflowStart(api, state, evt);
    },
    [e.WORKFLOW_COMPLETE]: (evt) => {
      workflowComplete(api, state, evt);
    },
    [e.WORKFLOW_LOG]: (evt) => {
      log(api, state, evt);
    },
  };

  return api
    .callWorker('run', [state.plan, adaptorPaths], events)
    .catch((e) => {
      // TODO what about errors then?
      api.logger.error(e);
    });
};

export default execute;
