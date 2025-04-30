// run this file with limited memory
// --max-old-space-size=50 or whatever
// NODE_OPTIONS="--max-old-space-size=50"

import { createMockLogger } from '@openfn/logger';
import { randomUUID } from 'node:crypto';
import createAPI from '../src/api';

let completedCount = 0;
const logger = createMockLogger();

let api;

function run() {
  const job = `
  export default [(state) => {
    state.data = new Array(1024 * 1024 * 4).fill('z').join('')
    return state
  }]`;

  const plan = {
    id: randomUUID(),
    workflow: {
      steps: [
        {
          expression: job,
        },
      ],
    },
    options: {},
  };
  console.log('>> running', plan.id);
  api.execute(plan, {});

  api.listen(plan.id!, {
    'workflow-complete': () => {
      completedCount++;
      console.log('>> Finished', completedCount);
      run();
    },
  });
}

async function start() {
  api = await createAPI({
    logger,
    // Disable compilation
    compile: {
      skip: true,
    },
    maxWorkers: 1,
  });

  run();
}

start();
