/**
 * A mock worker function used in unit tests
 * Needed partly because we don't need to test the actual runtime logic from here,
 * but also because we seem to lose the --experimental-vm-modules command flag
 * when we run a thread within an ava thread.
 *
 * This mock handler does nothing and returns after a while, ignoring the source argument
 * and reading instructions out of state object.
 */
import { register, publish } from './runtime';
import { execute, createLoggers } from './helpers';
import * as workerEvents from '../events';
import { State } from '@openfn/lexicon';

type MockJob = {
  id?: string;
  adaptor?: string;
  configuration?: any;

  expression?: string; // will evaluate as JSON
  data?: any; // data will be returned if there's no expression

  // MS to delay the return by (underscored because it's a mock property)
  _delay?: number;
};

type MockExecutionPlan = {
  id: string;
  workflow: {
    steps: MockJob[];
  };
};

// This is a fake runtime handler which will return a fixed value, throw, and
// optionally delay
function mockRun(plan: MockExecutionPlan, input: State, _options = {}) {
  if (!input) {
    throw new Error('no input passed to state');
  }

  const [job] = plan.workflow.steps;
  const { jobLogger } = createLoggers(plan.id!, 'none', publish);
  const workflowId = plan.id;
  return new Promise((resolve) => {
    const jobId = job.id || '<job>';
    setTimeout(async () => {
      publish(workerEvents.JOB_START, {
        workflowId,
        jobId,
        versions: { node: '1', runtime: '1', compiler: '1', engine: '1' },
      });
      // TODO this isn't data, but state - it's the whole state object (minus config)
      let state: any = { data: job.data || {} };
      if (job.expression) {
        try {
          // Security considerations of eval here?
          // If someone setup an rtm with the mock worker enabled,
          // then all job code would be actually evalled
          // To be fair, actual jobs wouldn't run, so it's not like anyone can run a malicious proxy server

          // Override the console in the expression scope
          const fn = new Function('console', 'return ' + job.expression)(
            jobLogger
          );
          state = await fn(state);
        } catch (e: any) {
          state = {
            data: job.data || {},
            error: {
              [job.id || 'job']: e.message,
            },
          };
        }
      }
      publish(workerEvents.JOB_COMPLETE, {
        workflowId,
        jobId,
        duration: 100,
        state,
        next: [],
        mem: { job: 100, system: 1000 },
      });
      resolve(state);
    }, job._delay || 1);
  });
}

register({
  run: async (plan: MockExecutionPlan, input: State, _options?: any) =>
    execute(plan.id, () => mockRun(plan, input)),
});
