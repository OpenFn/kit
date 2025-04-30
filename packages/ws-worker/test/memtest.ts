import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import createLightningServer from '@openfn/lightning-mock';
import { randomUUID } from 'node:crypto';

let completedCount = 0;

const MEMORY_LIMIT_MB = 70;

console.log('spawning lightning mock');

let keys = { private: '.', public: '.' };

const lightning = createLightningServer({
  port: 5551,
  // runPrivateKey: toBase64(keys.private),
});

console.log('spawning worker');
// spawn a worker in a new thread with limited memory
const worker = spawn(
  'pnpm',
  [
    'start',
    '--run-memory=500',
    //'--payload-memory=500',
    '--payload-memory=11',
    '--capacity=1',
    '-l ws://localhost:5551/worker',
    '--log info',
  ],
  {
    env: {
      ...process.env,
      NODE_OPTIONS: `--max-old-space-size=${MEMORY_LIMIT_MB}`,
      WORKER_LIGHTNING_PUBLIC_KEY: undefined,
    },
  }
);

worker.stdout.on('data', (data) => {
  console.log(data.toString().trim());
});
worker.stderr.on('data', (data) => {
  console.error(data.toString().trim());
});

worker.on('close', (code) => {
  console.log(`worker exited with code: ${code}`);
});

// This job emits a payload large enough
// to kill the main worker
const job = `
export default [(state) => {
  state.data = new Array(1024 * 1024 * 4).fill('z').join('')
  return state
}]
`;

queue();

function queue() {
  const run = {
    id: randomUUID(),
    jobs: [
      {
        body: job,
      },
    ],
  };

  lightning.waitForResult(run.id).then((result: any) => {
    completedCount++;

    // console.log(result);
    console.log('Finished', completedCount);

    console.log('enqueuing one more!');
    queue();
  });

  setTimeout(() => {
    lightning.enqueueRun(run);
  }, 500);
}
