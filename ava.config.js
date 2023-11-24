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
    '--expose-gc', // TODO this should only be in the runtime
  ],

  workerThreads: false, // TMP runtime only - needed to expose gc

  files: ['test/**/*test.ts'],
};
