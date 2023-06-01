// Execute a compiled workflow
import type { WorkerPool } from 'workerpool';
import type { ExecutionPlan } from '@openfn/runtime';
import * as e from '../events';

// A lot of callbacks needed here
// Is it better to just return the handler?
// But then this function really isn't doing so much
// (I guess that's true anyway)
const execute = (workers: WorkerPool, onAcceptJob?, onLog?, onError?) => {
  return (plan: ExecutionPlan) => {
    return new Promise((resolve) => {
      console.log('executing...');
      try {
        workers.exec('run', [plan], {
          on: ({ type, ...args }: e.JobEvent) => {
            console.log('EVENT', type);
            if (type === e.ACCEPT_JOB) {
              console.log('accept');
              const { jobId, threadId } = args as e.AcceptJobEvent;
              onAcceptJob?.(jobId, plan.id, threadId);
            } else if (type === e.COMPLETE_JOB) {
              console.log('complete');
              const { jobId, state } = args as e.CompleteJobEvent;
              resolve(state);
            }
          },
        });
      } catch (e) {
        console.log(e);
      }
    });
  };
};

export default execute;
