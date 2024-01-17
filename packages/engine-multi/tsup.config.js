import baseConfig from '../../tsup.config';

export default {
  ...baseConfig,
  splitting: false,
  entry: {
    index: 'src/index.ts',
    'worker/thread/run': 'src/worker/thread/run.ts',
    // TODO I don't actually want to build this into the dist, I don't think?
    'worker/mock': 'src/worker/mock-worker.ts',
    'worker/child/runner': 'src/worker/child/runner.ts',
    'test/worker-functions': 'src/test/worker-functions.ts',
  },
};
