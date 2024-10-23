import test from 'ava';
import { fork } from 'node:child_process';

import { createRun, createJob } from '../src/factories';
import { initLightning, initWorker } from '../src/init';

let lightning;
let workerProcess;

const spawnServer = (port: string | number = 1, args: string[] = []) => {
  return new Promise((resolve) => {
    const options = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] as any[],
    };

    // We use fork because we want IPC messaging with the processing
    workerProcess = fork(
      './node_modules/@openfn/ws-worker/dist/start.js',
      [
        `-l ws://localhost:${port}/worker`,
        '--backoff 0.001/0.01',
        '--log debug',
        '-s secretsquirrel',
        '--collections-token=1.0.0',
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
    // workerProcess.stdout.on('data', (data) => {
    //   console.log(data.toString());
    // });
  });
};

test.afterEach(async () => {
  lightning?.destroy();
  await workerProcess?.kill();
});

let portgen = 3000;

const getPort = () => ++portgen;

// note that lightning isnt available here, and this is fine
test.serial('worker should start, respond to 200, and close', async (t) => {
  workerProcess = await spawnServer();

  // The running server should respond to a get at root
  let { status } = await fetch('http://localhost:2222/');
  t.is(status, 200);

  workerProcess.kill('SIGTERM');

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

test.serial('allow a job to complete after receiving a sigterm', (t) => {
  return new Promise(async (done) => {
    let didKill = false;
    const port = getPort();
    lightning = initLightning(port);

    const job = createJob({
      // This job needs no adaptor (no autoinstall here!) and returns state after 1 second
      adaptor: '',
      body: 'export default [(s) => new Promise((resolve) => setTimeout(() => resolve(s), 1000))]',
    });
    const attempt = createRun([], [job], []);

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

        const finishTimeout = setTimeout(() => {
          done();
        }, 500);

        // Lightning should receive no more claims
        lightning.on('claim', () => {
          clearTimeout(finishTimeout);
          t.fail();
          done();
        });
      }, 10);
    });

    workerProcess = await spawnServer(port);
    lightning.enqueueRun(attempt);

    // give the attempt time to start, then kill the server
    setTimeout(() => {
      didKill = true;
      workerProcess.kill('SIGTERM');
    }, 100);
  });
});

test.serial('healthcheck', async (t) => {
  workerProcess = await spawnServer();

  let { status } = await fetch('http://localhost:2222/livez');
  t.is(status, 200);
});
