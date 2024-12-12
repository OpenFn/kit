const semver = require("semver")

const loader_arg = semver.lte(process.version, 'v20.5.0') ? '--loader=@swc-node/register/esm' : '--import=@swc-node/register/esm-register'
module.exports = {
  extensions: {
    ts: 'module',
  },

  environmentVariables: {
    TS_NODE_TRANSPILE_ONLY: 'true',
  },

  nodeArguments: [
    loader_arg,
    '--no-warnings', // Disable experimental module warnings
    '--experimental-vm-modules',
  ],

  files: ['test/**/*test.ts'],
};
