// WORKER_DISABLE_EXIT_LISTENERS=true clinic heapprofiler -- node clinic.js 1 --open false --collect-only
// start lightning: pnpm start --port 9991
import { getHeapStatistics } from 'node:v8';
import createWorker from './dist/index.js';
import createRTE from '@openfn/engine-multi';
import createLightningServer from '@openfn/lightning-mock';

let lng;
let worker;
let idgen = 1;

const WORKFLOW_COUNT = 10;
// const WORKFLOW_COUNT = 3; // this is enough to repro the problem
let workflowsFinished = 0;

await setup();
heap('SETUP');
await test();

setInterval(() => {
  heap('POLL');
}, 1000);

function heap(reason) {
  const { used_heap_size } = getHeapStatistics();
  const mb = used_heap_size / 1024 / 1024;
  console.log(`>> [${reason}] Used heap at ${mb.toFixed(2)}mb`);
}

// start the server
async function setup() {
  const engineOptions = {
    repoDir: process.env.OPENFN_REPO_DIR,
    maxWorkers: 4,
  };

  const engine = await createRTE(engineOptions);

  // TODO best to keep this out of process as it also uses memory
  // lng = createLightningServer({
  //   port: 9991,
  // });

  worker = createWorker(engine, {
    port: 9992,
    lightning: 'ws://localhost:9991/worker',
    maxWorkflows: 1,
    backoff: {
      min: 10,
      max: 5e4,
    },
  });

  worker.on('workflow-complete', (evt) => {
    heap('WORKFLOW:COMPLETE');
    if (++workflowsFinished === WORKFLOW_COUNT) {
      console.log('>> all done!');
      console.log('>> Hit CTRL+C to exit and generate heap profile');
      // process.send('SIGINT');
      // process.abort();
      // process.exit(0);
    }
  });
}

// send a bunch of jobs through
async function test() {
  const sleep = (duration = 100) =>
    new Promise((resolve) => setTimeout(resolve, duration));

  let count = 0;
  const max = 1;

  while (count++ < WORKFLOW_COUNT) {
    const w = wf();
    console.log(' > posting', w.id);
    fetch(`http://localhost:9991/run`, {
      method: 'POST',
      body: JSON.stringify(w),
      headers: {
        'content-type': 'application/json',
      },
    });
    // await sleep(60 * 1000);
    await sleep(500);
  }
}

function wf() {
  const step = `
export default [(state) => {
  state.data = []
    let counter = 1e4;
    while(--counter) {
      const str = new Array(1e3).fill(1).join('')
      state.data.push(str)
    }
    state.data = state.data.join()
    console.log(state.data.length)
  return state;
}]`;
  return {
    id: `run-${idgen++}`,
    triggers: [],
    edges: [],
    jobs: [
      {
        id: 'a',
        body: step,
      },
    ],
  };
}
