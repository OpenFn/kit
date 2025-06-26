import test from 'ava';
import { fork } from 'node:child_process';

import { createRun, createJob } from '../src/factories';
import { initLightning, initWorker } from '../src/init';

let lightning;
let workerProcess;

const spawnServer = (port: string | number = 1, args: string[] = []) => {
  return new Promise(async (resolve) => {
    const options = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] as any[],
      env: {},
    };

    // We use fork because we want IPC messaging with the processing
    workerProcess = fork(
      './node_modules/@openfn/ws-worker/dist/start.js',
      [
        `-l ws://localhost:${port}/worker`,
        '--backoff=0.0001/0.01',
        '--log=debug',
        '--collections-version=1.0.0',
        '--debug', // alow us to run without keys
        ...args,
      ],
      options
    );

    workerProcess.on('message', (message) => {
      if (message === 'READY') {
        resolve(workerProcess);
      }
    });

    // Uncomment for logs
    workerProcess.stdout.on('data', (data) => {
      console.log(data.toString());
    });
  });
};

test.afterEach(async () => {
  lightning?.destroy();
  await workerProcess?.kill();
});

let portgen = 3000;

const getPort = () => ++portgen;

function waitForWorkerExit(worker, limit = 10000) {
  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      reject(new Error('timeout'));
    }, limit);

    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve('Worker exited successfully');
      } else {
        reject(new Error(`Worker exited with code: ${code}`));
      }
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(err); // Reject if an error occurs
    });
  });
}

// note that lightning isnt available here, and this is fine
test.serial('worker should start, respond to 200, and close', async (t) => {
  t.plan(2);
  workerProcess = await spawnServer();

  // The running server should respond to a get at root
  let { status } = await fetch('http://localhost:2222/');
  t.is(status, 200);

  workerProcess.kill('SIGTERM');
  await waitForWorkerExit(workerProcess);
  // After being killed, the fetch should fail
  await t.throwsAsync(() => fetch('http://localhost:2222/'), {
    message: 'fetch failed',
  });
});

test.serial('should connect to lightning', (t) => {
  return new Promise(async (done) => {
    const port = getPort();
    lightning = initLightning(port);

    lightning.on('socket:connect', () => {
      t.pass('connection recieved');
      done();
    });

    workerProcess = await spawnServer(port);
  });
});

test.serial('should join attempts queue channel', (t) => {
  return new Promise(async (done) => {
    const port = getPort();
    lightning = initLightning(port);

    lightning.on('socket:channel-join', ({ channel }) => {
      if (channel === 'worker:queue') {
        t.pass('joined channel');
        done();
      }
    });

    workerProcess = await spawnServer(port);
  });
});

// TODO: test this after two jobs are active
// because once the first one completes, it must not restore the claim loop
test('allow a job to complete after receiving a sigterm', (t) => {
  return new Promise(async (done) => {
    let didKill = false;
    const port = getPort();

    const job = createJob({
      // This job needs no adaptor (no autoinstall here!) and returns state after 1 second
      adaptor: '',
      body: 'export default [(s) => new Promise((resolve) => setTimeout(() => resolve(s), 1000))]',
    });
    const attempt = createRun([], [job], []);

    workerProcess = await spawnServer(port);
    lightning = initLightning(port);

    lightning.once('run:complete', (evt) => {
      t.true(didKill); // Did we kill the server before this returned?
      t.is(evt.payload.reason, 'success'); // did the attempt succeed?
      t.pass('ok');

      // Give the server some time to shut down
      setTimeout(async () => {
        // The webserver should not respond
        await t.throwsAsync(() => fetch('http://localhost:2222/'), {
          message: 'fetch failed',
        });

        waitForWorkerExit(workerProcess).then(() => {
          done();
        });

        // Lightning should receive no more claims
        lightning.on('claim', () => {
          t.fail();
          done();
        });
      }, 10);
    });

    lightning.enqueueRun(attempt);

    // give the attempt time to start, then kill the server
    setTimeout(() => {
      didKill = true;
      workerProcess.kill('SIGTERM');
    }, 300);
  });
});

// This test doesn't really work because of a bug in the mock, I think
// Something in the mock lightning is stalled/awaiting
// So even though the worker has triggered a claim event,
// the mock doesn't emit it back out to the test until the job is finished
// It's like the mock socket is waiting for run-complete before it'll respond to any claim events
test.skip("don't restore the claim loop after a sigterm", (t) => {
  return new Promise(async (done) => {
    let didKill = false;
    let abort = false;
    const port = getPort();

    const job = createJob({
      // This job needs no adaptor (no autoinstall here!) and returns state after 1 second
      adaptor: '',
      body: 'export default [(s) => new Promise((resolve) => setTimeout(() => resolve(s), 500))]',
    });

    const a = createRun([], [job], []);
    const b = createRun(
      [],
      [
        {
          ...job,
          body: job.body.replace('500', '1000'), // TODO should be able to shorten these delays once I fix the test
        },
      ],
      []
    );

    workerProcess = await spawnServer(port, ['--capacity=2']);
    lightning = initLightning(port);

    // After the second run starts, there should be no more claims
    lightning.on('run:start', (evt) => {
      if (evt.runId === b.id) {
        // Kill the worker once the second job has started
        // This will force an overlap of two pending runs at full capacity
        workerProcess.kill('SIGTERM');

        lightning.on('claim', () => {
          abort = true;
          t.fail('Claim triggered after sigterm');
          done();
        });
      }
    });

    // We can end the test when the worker has shut down

    lightning.enqueueRun(a);
    lightning.enqueueRun(b);

    await waitForWorkerExit(workerProcess).then(() => {
      if (!abort) {
        t.pass();
        done();
      }
    });
  });
});

test.serial('healthcheck', async (t) => {
  workerProcess = await spawnServer();

  let { status } = await fetch('http://localhost:2222/livez');
  t.is(status, 200);
});
