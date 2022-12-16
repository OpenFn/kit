export default {
  format: 'esm',
  target: 'node18',
  clean: true,
  // Include a dts file
  // This will slow down the build AND fail if there are tsc errors
  // Way may want to disable it in watch mode?
  dts: true,
};
