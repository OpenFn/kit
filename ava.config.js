module.exports = {
  extensions: {
    ts: 'module',
  },

  environmentVariables: {
    TS_NODE_TRANSPILE_ONLY: 'true',
  },

  nodeArguments: [
    '--loader=ts-node/esm',
    '--no-warnings', // Disable experimental module warnings
    '--experimental-vm-modules',
  ],

  files: ['test/**/*test.ts'],
};
