import baseConfig from '../../tsup.config';

export default {
  ...baseConfig,
  output: 'index.web.js',
  entry: {
    web: 'src/index.ts',
  },
  dts: false,
  clean: false,
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'chrome80',
  noExternal: ['@openfn', 'typescript', 'cross-fetch', 'url-join'],
};
