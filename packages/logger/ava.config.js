export default {
  // extensions: {
  //   ts: 'module',
  // },

  // In node 18.9.0, which CI uses, worker threads don't seem to
  // inherit the --loader argument and so fail to load ts
  // Switching worker threads off will use child processes, which is slower
  // and more memory intensive
  // workerThreads: false,

  typescript: {
    rewritePaths: {
      'src/': 'dist/',
    },
    // compile: 'tsc',
    compile: false,
  },

  // environmentVariables: {
  //   TS_NODE_TRANSPILE_ONLY: 'true',
  // },

  // nodeArguments: [
  //   // '--loader=ts-node/esm',
  //   '--no-warnings', // Disable experimental module warnings
  //   '--experimental-vm-modules',
  // ],

  // files: ['test/**/*test.ts'],
};
