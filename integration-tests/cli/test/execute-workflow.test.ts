import test from 'ava';
import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';

import createLightningServer from '@openfn/lightning-mock';

import run from '../src/run';
import { getJSON } from '../src/util';

// set up a lightning mock
let server: any;

const port = 8968;

test.before(async () => {
  server = await createLightningServer({ port });
  server.collections.createCollection('stuff');
  // Important: the collection value MUST be as string
  server.collections.upsert('stuff', 'x', JSON.stringify({ id: 'x' }));
});

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
  t.is(out.data.items.length, 3);
  t.true(out.data.items.includes('c'));
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
    t.is(out.data.items.length, 4);
    t.deepEqual(out.data.items, ['z', 'a', 'b', 'c']);
  }
);

// special start step
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

// only step
test.serial(
  `openfn ${jobsPath}/wf-array.json --only b -S "{ \\"data\\": { \\"items\\": [] } }"`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.is(out.data.items.length, 1);
    t.false(out.data.items.includes('a'));
    t.true(out.data.items.includes('b'));
    t.false(out.data.items.includes('c'));
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

test.serial(
  `openfn ${jobsPath}/wf-creds.json --credentials ${jobsPath}/creds.json`,
  async (t) => {
    const { err, stdout, stderr } = await run(t.title);
    console.log({ stdout, stderr });
    t.falsy(err);

    const out = getJSON();
    t.is(out.value, 'admin:admin');
  }
);

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
  `openfn ${jobsPath}/wf-errors.json -iS "{ \\"data\\": { \\"number\\": 32 } }"`,
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
          source: 'runtime',
          name: 'JobError',
          severity: 'fail',
          message: 'abort',
        },
      },
    });
  }
);

// export issues https://github.com/OpenFn/kit/issues/238
test.serial(
  `openfn ${jobsPath}/common-date.json -s ${jobsPath}/common-date-input.json`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();
    t.deepEqual(out, {
      data: '01/01/2024',
      result: '2024-01-01T00:00:00.000Z',
    });
  }
);

test.serial(
  `openfn ${jobsPath}/different-adaptor-versions.json -l debug`,
  async (t) => {
    const { err, stdout } = await run(t.title);
    t.falsy(err);

    t.regex(
      stdout,
      /Resolved adaptor @openfn\/language-common to version 2.1.0/
    );
    t.regex(
      stdout,
      /Resolved adaptor @openfn\/language-common to version 2.0.3/
    );

    const out = getJSON();
    t.deepEqual(out, {
      z: 1,
    });
  }
);

test.serial(`openfn ${jobsPath}/globals-exp.json`, async (t) => {
  const res = await run(t.title);
  t.falsy(res.err);
  const out = getJSON();
  t.deepEqual(out, {
    alter: 'heartsfx',
    data: {},
    final: 'some-big-valueheartsfx',
    val: 'some-big-value',
  });
});

test.serial(`openfn ${jobsPath}/globals-path.json`, async (t) => {
  const res = await run(t.title);
  t.falsy(res.err);
  const out = getJSON();
  t.deepEqual(out, {
    alter: 'heart.path.value',
    data: {},
    final: 'path-valueheart.path.value',
    val: 'path-value',
  });
});

test.serial(
  `openfn ${jobsPath}/globals-job.js --globals="export const suffixer = w => w + '-some-suffix'" -a common`,
  async (t) => {
    const res = await run(t.title);
    t.falsy(res.err);
    const out = getJSON();
    t.deepEqual(out, {
      data: {
        result: 'love-some-suffix',
      },
    });
  }
);

test.serial(
  `openfn ${jobsPath}/globals-job.js --globals ${jobsPath}/globals-path-file.js -a common`,
  async (t) => {
    const res = await run(t.title);
    t.falsy(res.err);
    const out = getJSON();
    t.deepEqual(out, {
      data: {
        result: 'love-humble-suffix',
      },
    });
  }
);

// collections basic test
test.serial(
  `openfn ${jobsPath}/collections.json --endpoint http://localhost:${port} --api-key xyz`,
  async (t) => {
    const { err } = await run(t.title);
    t.falsy(err);

    const out = getJSON();

    t.deepEqual(out.data, { id: 'x' });
  }
);
