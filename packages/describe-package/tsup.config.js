import baseConfig from '../../tsup.config';

export default {
  ...baseConfig,
  bundle: true,
  // shims: true,
  // target: "chrome106",
  platform: 'browser', // TODO I nee to create a browser build and export that differently
  // external: ['node-fetch'],
  // external: ['fs', 'events', 'stream', 'path', 'util', 'constants', 'assert'],
  noExternal: ["@openfn", "typescript", "cross-fetch", "url-join"],
  // target: 'chrome'

};
