import baseConfig from '../../tsup.config';

export default {
  ...baseConfig,
  splitting: false,
  entry: {
    index: 'src/index.ts',
    'worker/thread/run': 'src/worker/thread/run.ts',
    'worker/child/runner': 'src/worker/child/runner.ts',

    'test/mock-run': 'src/worker/thread/mock-run.ts',
    'test/worker-functions': 'src/test/worker-functions.ts',
  },
};
