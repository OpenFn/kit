import test from 'ava';
import path from 'node:path';

import { createAttempt, createEdge, createJob } from '../src/factories';
import { initLightning, initWorker } from '../src/init';

let lightning;
let worker;

test.before(async () => {
  const lightningPort = 4321;

  lightning = initLightning(lightningPort);

  ({ worker } = await initWorker(lightningPort, {
    repoDir: path.resolve('tmp/openfn/repo/attempts'),
  }));
});

test.after(async () => {
  lightning.destroy();
  await worker.destroy();
});

const run = async (attempt) => {
  return new Promise<any>(async (done, reject) => {
    lightning.once('attempt:complete', (evt) => {
      if (attempt.id === evt.attemptId) {
        done(lightning.getResult(attempt.id));
      } else {
        // If we get here, something has gone very wrong
        reject('attempt not found');
      }
    });

    lightning.enqueueAttempt(attempt);
  });
};

test('echo initial state', async (t) => {
  const initialState = { data: { count: 22 } };

  lightning.addDataclip('s1', initialState);

  const job = createJob({ body: 'fn((s) => s)' });
  const attempt = createAttempt([job], [], {
    dataclip_id: 's1',
  });

  const result = await run(attempt);

  t.deepEqual(result, {
    data: {
      count: 22,
    },
  });
});

// hmm this event feels a bit fine-grained for this
// This file should just be about input-output
// TODO maybe move it into integrations later
test('run parallel jobs', async (t) => {
  const initialState = { data: { count: 22 } };

  lightning.addDataclip('s1', initialState);

  /*
         [a]   
        /   \
      [x]   [y]
  */
  const a = createJob({ body: 'fn((s) => ({ data: { a: true }}))' });
  const x = createJob({ body: 'fn((s) => { s.data.x = true; return s; })' });
  const y = createJob({ body: 'fn((s) => { s.data.y = true; return s; })' });
  const ax = createEdge(a, x);
  const ay = createEdge(a, y);
  const jobs = [a, x, y];
  const edges = [ax, ay];

  const attempt = createAttempt(jobs, edges, {
    dataclip_id: 's1',
  });

  // This saves JSON returned by a job
  const outputJson = {};

  // This saves the dataclip returned by a job
  const outputId = {};

  lightning.on('run:start', (evt) => {
    // x and y should both be passed the dataclip produced by job a
    if (evt.payload.run_id === x.id || evt.payload.run_id === y.id) {
      evt.payload.input_dataclip_id = outputId[a.id];
    }
  });

  lightning.on('run:complete', (evt) => {
    // save the output dataclip
    outputJson[evt.payload.job_id] = evt.payload.output_dataclip_id;
    outputJson[evt.payload.job_id] = JSON.parse(evt.payload.output_dataclip);
  });

  const result = await run(attempt);

  t.deepEqual(outputJson[x.id].data, {
    a: true,
    x: true,
    // Should not include a write from y
  });
  t.deepEqual(outputJson[y.id].data, {
    a: true,
    y: true,
    // Should not include a write from x
  });

  // I think the result should look like this - but it won't without work
  // t.deepEqual(result, {
  //   [x.id]: {
  //     a: true,
  //     x: true,
  //   },
  //   [y.id]: {
  //     a: true,
  //     y: true,
  //   },
  // });
});
