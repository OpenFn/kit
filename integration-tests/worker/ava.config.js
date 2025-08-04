import semver from 'semver';

const loader_arg = semver.lte(process.version, 'v20.5.0')
  ? '--loader=@swc-node/register/esm'
  : '--import=@swc-node/register/esm-register';

// TODO this seems to be needed locally? the above switch works in CI but not local
// const loader_arg = '--import=@swc-node/register/esm-register';

console.log(loader_arg);
export default {
  extensions: {
    ts: 'module',
  },

  environmentVariables: {
    TS_NODE_TRANSPILE_ONLY: 'true',
  },

  nodeArguments: [loader_arg, '--no-warnings'],

  files: ['test/**/*test.ts'],
};
