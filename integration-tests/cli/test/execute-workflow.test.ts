import test from 'ava';
import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import run from '../src/run';
import { getJSON } from '../src/util';

const jobsPath = path.resolve('test/fixtures');

// Note that these tests are STATEFUL
// Ensure the repo is clean and clear before these tests run
test.before(async () => {
  await mkdir('tmp', { recursive: true });
  await run('openfn repo clean -f --log none');
});

test.afterEach(async () => {
  try {
    await rm('jobs/output.json');
  } catch (e) {}
  try {
    await rm('tmp/.', { recursive: true });
  } catch (e) {}
});

// Autoinstall adaptors
test.serial(`openfn ${jobsPath}/wf-count.json -i`, async (t) => {
  const { err } = await run(t.title);
  t.falsy(err);

  const out = getJSON();
  t.is(out.data.count, 42);
});

// Run without autoinstall
test.serial(
  `openfn ${jobsPath}/wf-count.json -S "{ \\"data\\": { \\"count\\": 6 } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.is(out.data.count, 12);
  }
);

// Multiple steps, shared array
test.serial(`openfn ${jobsPath}/wf-array.json`, async (t) => {
  const { err } = await run(t.title);
  t.falsy(err);

  const out = getJSON();
  t.is(out.data.items.length, 2);
  t.true(out.data.items.includes('b'));
  t.true(out.data.items.includes('c'));
});

// Multiple steps, shared array, initial state
test.serial(
  `openfn ${jobsPath}/wf-array.json -S "{ \\"data\\": { \\"items\\": [\\"z\\"] } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.is(out.data.items.length, 3);
    t.true(out.data.items.includes('z'));
    t.true(out.data.items.includes('b'));
    t.true(out.data.items.includes('c'));
  }
);

// special start node
test.serial(
  `openfn ${jobsPath}/wf-array.json --start b -S "{ \\"data\\": { \\"items\\": [] } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.is(out.data.items.length, 2);
    t.true(out.data.items.includes('b'));
    t.true(out.data.items.includes('c'));
  }
);

// Run a new-style execution plan with custom start
test.serial(`openfn ${jobsPath}/plan.json -i`, async (t) => {
  const { err } = await run(t.title);
  t.falsy(err);

  const out = getJSON();
  t.deepEqual(out.data.userId, 1);
});

test.serial(`openfn ${jobsPath}/wf-conditional.json`, async (t) => {
  const { err } = await run(t.title);
  t.falsy(err);

  const out = getJSON();
  t.is(out.data.result, 'small');
});

test.serial(
  `openfn ${jobsPath}/wf-conditional.json -S "{ \\"data\\": { \\"number\\": 5 } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.is(out.data.result, 'small');
  }
);

test.serial(
  `openfn ${jobsPath}/wf-conditional.json -S "{ \\"data\\": { \\"number\\": 20 } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.is(out.data.result, 'large');
  }
);

test.serial(
  `openfn ${jobsPath}/wf-simple.json -S "{ \\"data\\": { \\"count\\": 2 } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.is(out.data.count, 4);
  }
);

test.serial(`openfn ${jobsPath}/wf-strict.json --strict`, async (t) => {
  const { err } = await run(t.title);
  t.falsy(err);

  const out = getJSON();
  t.deepEqual(out, {
    data: {
      name: 'jane',
    },
  });
});

test.serial(`openfn ${jobsPath}/wf-strict.json --no-strict`, async (t) => {
  const { err } = await run(t.title);
  t.falsy(err);

  const out = getJSON();
  t.deepEqual(out, {
    x: 22,
    data: {
      name: 'jane',
    },
    references: [
      {
        name: 'bob',
      },
    ],
  });
});

test.serial(
  `openfn ${jobsPath}/wf-errors.json -S "{ \\"data\\": { \\"number\\": 2 } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.deepEqual(out, {
      data: {
        number: 3,
      },
    });
  }
);

test.serial(
  `openfn ${jobsPath}/wf-errors.json -S "{ \\"data\\": { \\"number\\": 32 } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.deepEqual(out, {
      data: {
        number: 32,
      },
      errors: {
        start: {
          error: {
            message: 'abort',
            type: 'JobError',
            name: 'JobError',
            severity: 'fail',
            source: 'runtime',
          },
          jobId: 'start',
          message: 'abort',
          type: 'JobError',
        },
      },
    });
  }
);
