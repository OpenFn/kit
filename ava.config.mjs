const config = {
  files: ['test/**/*'],
  extensions: {
    ts: "module"
  },
  require: ['ts-node/register/transpile-only'],
  nodeArguments: [
    '--loader=ts-node/esm',
    '--experimental-specifier-resolution=node'
  ],
  typescript: {
    compile: false,
    rewritePaths: {
      'src/': 'dist/'
    }
  },
  timeout: '6m'
};

export default config; 