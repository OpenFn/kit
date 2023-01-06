export default {
  extensions: {
    ts: 'module',
  },

  environmentVariables: {
    TS_NODE_TRANSPILE_ONLY: 'true',
  },

  nodeArguments: ['--loader=ts-node/esm'],

  files: ['src/**/*test.ts'],
};
