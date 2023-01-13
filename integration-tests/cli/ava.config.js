export default {
  extensions: {
    ts: 'module',
  },

  environmentVariables: {
    TS_NODE_TRANSPILE_ONLY: 'true',
  },

  nodeArguments: ['--loader=ts-node/esm', '--no-warnings'],

  files: ['test/**/*test.ts'],
};
