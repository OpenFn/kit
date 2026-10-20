const path = require('node:path');
const { pathToFileURL } = require('node:url');
const semver = require("semver")

const loader_arg = semver.lte(process.version, 'v20.5.0') ? '--loader=@swc-node/register/esm' : '--import=@swc-node/register/esm-register'

// Loaded before any test file, so that every module sees the patched fs
const memfs = pathToFileURL(
  path.join(__dirname, 'packages/test-helpers/src/memfs.ts')
).href;

module.exports = {
  extensions: {
    ts: 'module',
  },

  environmentVariables: {
    TS_NODE_TRANSPILE_ONLY: 'true',
  },

  nodeArguments: [
    loader_arg,
    `--import=${memfs}`,
    '--no-warnings', // Disable experimental module warnings
    '--experimental-vm-modules',
  ],

  files: ['test/**/*test.ts'],
};
