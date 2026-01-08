import test from 'ava';
import path from 'node:path';
import { generateKeys } from '@openfn/lightning-mock';

import {
  createRun,
  createEdge,
  createJob,
  createTrigger,
} from '../src/factories';
import { initLightning, initWorker } from '../src/init';

let lightning;
let worker;

test.before(async () => {
  const keys = await generateKeys();
  const lightningPort = 4321;

  lightning = initLightning(lightningPort, keys.private);

  ({ worker } = await initWorker(
    lightningPort,
    {
      repoDir: path.resolve('tmp/repo/attempts'),
    },
    {
      collectionsVersion: '0.5.0',
      collectionsUrl: 'http://localhost:4321/collections',
      runPublicKey: keys.public,
    }
  ));
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
      t.is(payload.reason, 'success');

      // TODO friendlier job names for this would be nice (rather than run ids)
      t.log(
        `run ${payload.step_id} done in ${payload.duration / 1000}s [${humanMb(
          payload.mem?.job
        )} / ${humanMb(payload.mem?.system)}mb] [thread ${payload.thread_id}]`
      );
    });
    lightning.on('run:complete', (evt) => {
      if (attempt.id === evt.runId) {
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
  const attempt = createRun([], [job], [], {
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
  const attempt = createRun([trigger], [job], [edge], {
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

  const attempt = createRun([], jobs, edges, {
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

test.serial('run a http adaptor job', async (t) => {
  const job = createJob({
    adaptor: '@openfn/language-http@7.2.0',
    body: `get("https://jsonplaceholder.typicode.com/todos/1");
    fn((state) => { state.res = state.response; return state });`,
  });
  const attempt = createRun([], [job], []);
  const result = await run(t, attempt);

  t.truthy(result.res);
  t.is(result.res.statusCode, 200);
  t.truthy(result.res.headers);

  t.deepEqual(result.data, {
    userId: 1,
    id: 1,
    title: 'delectus aut autem',
    completed: false,
  });
});

test.serial('use different versions of the same adaptor', async (t) => {
  // http@5 exported an axios global - so run this job and validate that the global is there
  const job1 = createJob({
    body: `import { axios } from "@openfn/language-http";
    fn((s) => {
      if (!axios) {
        throw new Error('AXIOS NOT FOUND')
      }
      return s;
    })`,
    adaptor: '@openfn/language-http@5.0.4',
  });

  // http@6 no longer exports axios - so throw an error if we see it
  const job2 = createJob({
    body: `import { axios } from "@openfn/language-http";
    fn((s) => {
      if (axios) {
        throw new Error('AXIOS FOUND')
      }
      return s;
    })`,
    adaptor: '@openfn/language-http@6.0.0',
  });

  // Just for fun, run each job a couple of times to make sure that there's no wierd caching or ordering anything
  const steps = [job1, job2, job1, job2];
  const attempt = createRun([], steps, []);

  const result = await run(t, attempt);
  t.log(result);
  t.falsy(result.errors);
});

test.serial('Run with collections', async (t) => {
  const job1 = createJob({
    body: `fn((state = {}) => {
    const server = collections.createMockServer();
    collections.setMockClient(server);

    server.api.createCollection('collection');

    state.data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    state.results = [];
    return state;
  });

  collections.set('collection', v => v.id, $.data);

  collections.each('collection', '*', (state, value, key) => {
    state.results.push({ key, value })
  });
  `,
    // Note: for some reason 1.7.0 fails because it exports a collections ??
    // 1.7.4 seems fine
    adaptor: '@openfn/language-common@1.7.4',
  });
  const attempt = createRun([], [job1], []);

  const { results } = await run(t, attempt);
  t.deepEqual(results, [
    { key: 'a', value: { id: 'a' } },
    { key: 'b', value: { id: 'b' } },
    { key: 'c', value: { id: 'c' } },
  ]);
});

test.serial('Run with edge conditions', async (t) => {
  const job1 = createJob({
    body: `fn((s) => s)`,
  });
  const job2 = createJob({
    body: `fn((s) => {
      s.didExecuteStep2 = true
      return s;
    })`,
  });
  const edge = createEdge(job1, job2, {
    // I would prefer this ran  on failure, but that's a lot
    // harder to do the way these tests are set up
    condition: 'on_job_success',
  });
  const attempt = createRun([], [job1, job2], [edge]);

  const state = await run(t, attempt);
  t.true(state.didExecuteStep2);
});
