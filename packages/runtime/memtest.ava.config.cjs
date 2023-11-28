// This is special ava config just for the memory test, because:
// a) it should explicitly expose gc
// b) it does not use worker threads
// c) it should not run in ci
module.exports = {
  extensions: {
    ts: 'module',
  },

  environmentVariables: {
    TS_NODE_TRANSPILE_ONLY: 'true',
  },

  nodeArguments: [
    '--loader=ts-node/esm',
    '--no-warnings',
    '--experimental-vm-modules',
    '--expose-gc',
  ],

  workerThreads: false,

  files: ['test/memory.test.ts'],
};
