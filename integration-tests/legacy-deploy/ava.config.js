export default {
  files: ['test/**/*test.js'],
  // Polyfill the File global for Node 18 before undici 7 loads (see _setup.cjs)
  nodeArguments: ['--require=./test/_setup.cjs'],
};
