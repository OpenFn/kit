// Execute a compiled workflow
import * as e from '../events';
import { ModulePaths } from './autoinstall';

// A lot of callbacks needed here
// Is it better to just return the handler?
// But then this function really isn't doing so much
// (I guess that's true anyway)
const execute = (context: any, adaptorPaths: ModulePaths, events: any) => {
  const { workers, logger, plan } = context;
  const { start, log } = events;
  return new Promise((resolve) =>
    workers
      .exec('run', [plan, adaptorPaths], {
        on: ({ type, ...args }: e.WorkflowEvent) => {
          if (type === e.WORKFLOW_START) {
            const { workflowId, threadId } = args as e.AcceptWorkflowEvent;
            start?.(workflowId, threadId);
          } else if (type === e.WORKFLOW_COMPLETE) {
            const { state } = args as e.CompleteWorkflowEvent;
            resolve(state);
          } else if (type === e.WORKFLOW_LOG) {
            const { workflowId, message } = args as e.LogWorkflowEvent;
            log(workflowId, message);
          }
        },
      })
      .catch((e: any) => {
        logger.error(e);
      })
  );
};

export default execute;
