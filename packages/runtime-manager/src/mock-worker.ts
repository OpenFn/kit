/**
 * A mock worker function used in unit tests
 * Needed partly because we don't need to test the actual runtime logic from here,
 * but also because we seem to lose the --experimental-vm-modules command flag
 * when we run a thread within an ava thread.
 *
 * This mock handler does nothing and returns after a while, ignoring the source argument
 * and reading instructions out of state object.
 */
import workerpool from 'workerpool';
import helper from './worker-helper';

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
  jobs: MockJob[];
};

// This is a fake runtime handler which will return a fixed value, throw, and
// optionally delay
function mock(plan: MockExecutionPlan) {
  const [job] = plan.jobs;
  return new Promise((resolve) => {
    setTimeout(() => {
      let state: any = { data: job.data || {} };
      if (job.expression) {
        try {
          state = JSON.parse(job.expression);
        } catch (e) {
          state = {
            data: job.data || {},
            error: {
              [job.id || 'job']: e.message,
            },
          };
        }
      }
      resolve(state);
    }, job._delay || 1);
  });
}

workerpool.worker({
  run: async (plan: MockExecutionPlan, _repoDir?: string) =>
    helper(plan.id, () => mock(plan)),
});
