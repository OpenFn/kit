export default {
  extensions: {
    ts: 'module',
  },

  environmentVariables: {
    TS_NODE_TRANSPILE_ONLY: 'true',
  },

  nodeArguments: ['--loader=ts-node/esm', '--no-warnings', '--experimental-vm-modules'],

  files: ['test/**/*test.ts'],
};
