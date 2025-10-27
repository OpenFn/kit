// run this file with limited memory
// --max-old-space-size=50 or whatever
// NODE_OPTIONS="--max-old-space-size=50"
import { getHeapStatistics } from 'node:v8';
import { createMockLogger } from '@openfn/logger';
import { randomUUID } from 'node:crypto';
import createAPI from '../src/api';

let completedCount = 0;
const logger = createMockLogger();

let api: any;

function heap(reason) {
  const { used_heap_size } = getHeapStatistics();
  const mb = used_heap_size / 1024 / 1024;
  console.log(`>> [${reason}] Used heap at ${mb.toFixed(2)}mb`);
}

function run() {
  const job = `
  export default [(state) => {
    state.data = new Array(1024 * 1024 * 7).fill('z').join('')
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
  // console.log('>> running', plan.id);

  api.execute(plan, {});

  api.listen(plan.id!, {
    'workflow-complete': () => {
      completedCount++;
      heap('workflow-complete');
      console.log('>> Finished', completedCount);

      // setTimeout(() => {
      //   run();
      // }, 10);
    },
  });
}

const runBatch = () => {
  for (let i = 0; i < 4; i++) {
    run();
  }
};

async function start() {
  api = await createAPI({
    logger,
    maxWorkers: 4,
  });

  runBatch();
  setInterval(() => {
    runBatch();
  }, 200);
}

start();
