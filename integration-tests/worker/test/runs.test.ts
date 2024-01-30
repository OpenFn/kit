import test from 'ava';
import path from 'node:path';

import {
  createAttempt,
  createEdge,
  createJob,
  createTrigger,
} from '../src/factories';
import { initLightning, initWorker } from '../src/init';

let lightning;
let worker;

test.before(async () => {
  const lightningPort = 4321;

  lightning = initLightning(lightningPort);

  ({ worker } = await initWorker(lightningPort, {
    repoDir: path.resolve('tmp/repo/attempts'),
  }));
});

test.afterEach(async () => {
  lightning.destroy();
});

test.after(async () => {
  lightning.destroy();
  await worker.destroy();
});

const humanMb = (sizeInBytes: number) => Math.round(sizeInBytes / 1024 / 1024);

const run = async (t, attempt) => {
  return new Promise<any>(async (done, reject) => {
    lightning.on('step:complete', ({ payload }) => {
      // TODO friendlier job names for this would be nice (rather than run ids)
      t.log(
        `run ${payload.step_id} done in ${payload.duration / 1000}s [${humanMb(
          payload.mem.job
        )} / ${humanMb(payload.mem.system)}mb] [thread ${payload.thread_id}]`
      );
    });
    lightning.on('run:complete', (evt) => {
      if (attempt.id === evt.attemptId) {
        done(lightning.getResult(attempt.id));
      } else {
        // If we get here, something has gone very wrong
        reject('attempt not found');
      }
    });

    lightning.enqueueRun(attempt);
  });
};

test.serial('echo initial state', async (t) => {
  const initialState = { data: { count: 22 } };

  lightning.addDataclip('s1', initialState);

  const job = createJob({ body: 'fn((s) => s)' });
  const attempt = createAttempt([], [job], [], {
    dataclip_id: 's1',
  });

  const result = await run(t, attempt);

  t.deepEqual(result, {
    data: {
      count: 22,
    },
  });
});

test.serial('start from a trigger node', async (t) => {
  let runStartEvent;
  let runCompleteEvent;

  const initialState = { data: { count: 22 } };

  lightning.addDataclip('s1', initialState);

  const trigger = createTrigger();
  const job = createJob({ body: 'fn((s) => s)' });
  const edge = createEdge(trigger, job);
  const attempt = createAttempt([trigger], [job], [edge], {
    dataclip_id: 's1',
  });

  lightning.once('step:start', (evt) => {
    runStartEvent = evt.payload;
  });

  lightning.once('step:complete', (evt) => {
    runCompleteEvent = evt.payload;
  });

  await run(t, attempt);

  t.truthy(runStartEvent);
  t.is(runStartEvent.job_id, job.id);
  t.truthy(runStartEvent.step_id);
  t.is(runStartEvent.input_dataclip_id, 's1');

  t.truthy(runCompleteEvent);
  t.is(runCompleteEvent.reason, 'success');
  t.is(runCompleteEvent.error_message, null);
  t.is(runCompleteEvent.error_type, null);
  t.is(runCompleteEvent.job_id, job.id);
  t.truthy(runCompleteEvent.output_dataclip_id);
  t.is(runCompleteEvent.output_dataclip, JSON.stringify(initialState));
});

// hmm this event feels a bit fine-grained for this
// This file should just be about input-output
// TODO maybe move it into integrations later
test.serial('run parallel jobs', async (t) => {
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

  const attempt = createAttempt([], jobs, edges, {
    dataclip_id: 's1',
  });

  // This saves JSON returned by a job
  const outputJson = {};

  // This saves the dataclip returned by a job
  const outputId = {};

  lightning.on('step:start', (evt) => {
    // x and y should both be passed the dataclip produced by job a
    if (evt.payload.step_id === x.id || evt.payload.step_id === y.id) {
      evt.payload.input_dataclip_id = outputId[a.id];
    }
  });

  lightning.on('step:complete', (evt) => {
    // save the output dataclip
    outputJson[evt.payload.job_id] = evt.payload.output_dataclip_id;
    outputJson[evt.payload.job_id] = JSON.parse(evt.payload.output_dataclip);
  });

  await run(t, attempt);

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

test('run a http adaptor job', async (t) => {
  const job = createJob({
    adaptor: '@openfn/language-http@5.0.4',
    body: `get("https://jsonplaceholder.typicode.com/todos/1");
    fn((state) => { state.res = state.response; return state });`,
  });
  const attempt = createAttempt([], [job], []);
  const result = await run(t, attempt);

  t.truthy(result.res);
  t.is(result.res.status, 200);
  t.truthy(result.res.headers);

  t.deepEqual(result.data, {
    userId: 1,
    id: 1,
    title: 'delectus aut autem',
    completed: false,
  });
});
