// Execute a compiled workflow
import type { WorkerPool } from 'workerpool';
import type { ExecutionPlan } from '@openfn/runtime';
import { Logger } from '@openfn/logger';
import * as e from '../events';

// A lot of callbacks needed here
// Is it better to just return the handler?
// But then this function really isn't doing so much
// (I guess that's true anyway)
const execute = (
  workers: WorkerPool,
  repoDir: string,
  logger: Logger,
  events: any
) => {
  const { start, log, error } = events;
  return (plan: ExecutionPlan) => {
    return new Promise((resolve) =>
      workers
        .exec('run', [plan, repoDir], {
          on: ({ type, ...args }: e.WorkflowEvent) => {
            if (type === e.WORKFLOW_START) {
              const { workflowId, threadId } = args as e.AcceptWorkflowEvent;
              start?.(workflowId, threadId);
            } else if (type === e.WORKFLOW_COMPLETE) {
              const { workflowId, state } = args as e.CompleteWorkflowEvent;
              resolve(state);
            }
          },
        })
        .catch((e) => {
          logger.error(e);
        })
    );
  };
};

export default execute;