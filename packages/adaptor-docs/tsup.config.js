import baseConfig from '../../tsup.config';

export default {
  ...baseConfig,
  platform: 'browser',
  bundle: true,
  entry: {
    index: 'src/index.tsx',
  },
};
