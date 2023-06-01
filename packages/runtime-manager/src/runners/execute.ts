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
  const { accept, log, error } = events;
  return (plan: ExecutionPlan) => {
    return new Promise((resolve) =>
      workers
        .exec('run', [plan, repoDir], {
          on: ({ type, ...args }: e.JobEvent) => {
            if (type === e.ACCEPT_JOB) {
              const { jobId, threadId } = args as e.AcceptJobEvent;
              accept?.(jobId, plan.id, threadId);
            } else if (type === e.COMPLETE_JOB) {
              const { jobId, state } = args as e.CompleteJobEvent;
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
