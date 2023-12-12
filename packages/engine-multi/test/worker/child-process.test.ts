// just enough testing to dev against
// this is probably throwaway
import test from 'ava';

import workers from '../../src/worker/child-process';

// TODO is it worth a direct comparison with threads here?
// maybe?

test('run a workflow', async (t) => {
  const plan = {
    id: 'a',
    jobs: [
      {
        expression: 'export default [(s) => ({ x: 1 })]',
      },
    ],
  };

  const options = {};

  const result = await workers.exec('run', [plan, options]);

  t.deepEqual(result, { x: 1 });
});
