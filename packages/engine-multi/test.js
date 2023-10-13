import createAPI from './dist/index.js';
import createLogger from '@openfn/logger';

const api = createAPI({
  logger: createLogger(null, { level: 'debug' }),
  // Disable compilation
  compile: {
    skip: true,
  },
});

const plan = {
  id: 'a',
  jobs: [
    {
      expression: `export default [s => s]`,
      // with no adaptor it shouldn't try to autoinstall
    },
  ],
};

// this basically works so long as --experimental-vm-modules is on
// although the event doesn't feed through somehow, but that's different
const listener = api.execute(plan);
listener.on('workflow-complete', ({ state }) => {
  console.log(state);
  console.log('workflow completed');
  process.exit(0);
});
