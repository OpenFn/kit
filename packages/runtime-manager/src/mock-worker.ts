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

// Yeah not sure this import is right
import helper from './worker-helper';

const defaultArgs = {
  returnValue: 42,
  throw: undefined, // an error to throw
  timeout: 0, // a timeout to wait before throwing or returning
}

async function mock(args = defaultArgs) {
  const actualArgs = {
    ...defaultArgs,
    ...args
  };


  return actualArgs.returnValue;
}

workerpool.worker({
  run: async (jobId, _src, state) => {
    return helper(jobId, async () => mock(state))
  }
});


