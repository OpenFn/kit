import baseConfig from '../../tsup.config';

export default {
  ...baseConfig,
  splitting: false,
  entry: {
    index: 'src/index.ts',
    'worker/worker': 'src/worker/worker.ts',
    // TODO I don't actually want to build this into the dist, I don't think?
    'worker/mock': 'src/worker/mock-worker.ts',
  },
};
