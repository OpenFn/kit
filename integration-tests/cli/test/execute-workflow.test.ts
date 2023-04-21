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
  await run(t.title);

  const out = getJSON();
  t.is(out.data.count, 42);
});

// Run without autoinstall
test.serial(
  `openfn ${jobsPath}/wf-count.json -S "{ \\"data\\": { \\"count\\": 6 } }"`,
  async (t) => {
    await run(t.title);

    const out = getJSON();
    t.is(out.data.count, 12);
  }
);

// Multiple steps, shared array
test.serial(`openfn ${jobsPath}/wf-array.json`, async (t) => {
  await run(t.title);

  const out = getJSON();
  t.is(out.data.items.length, 2);
  t.true(out.data.items.includes('b'));
  t.true(out.data.items.includes('c'));
});

// Multiple steps, shared array, initial state
test.serial(
  `openfn ${jobsPath}/wf-array.json -S "{ \\"data\\": { \\"items\\": [\\"z\\"] } }"`,
  async (t) => {
    await run(t.title);

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
    await run(t.title);

    const out = getJSON();
    t.is(out.data.items.length, 1);
    t.true(out.data.items.includes('b'));
  }
);

test.serial(`openfn ${jobsPath}/wf-conditional.json`, async (t) => {
  await run(t.title);

  const out = getJSON();
  t.is(out.data.result, 'small');
});

test.serial(
  `openfn ${jobsPath}/wf-conditional.json -S "{ \\"data\\": { \\"number\\": 5 } }"`,
  async (t) => {
    await run(t.title);

    const out = getJSON();
    t.is(out.data.result, 'small');
  }
);

test.serial(
  `openfn ${jobsPath}/wf-conditional.json -S "{ \\"data\\": { \\"number\\": 20 } }"`,
  async (t) => {
    await run(t.title);

    const out = getJSON();
    t.is(out.data.result, 'large');
  }
);

test.serial(
  `openfn ${jobsPath}/wf-simple.json -S "{ \\"data\\": { \\"count\\": 2 } }"`,
  async (t) => {
    await run(t.title);

    const out = getJSON();
    t.is(out.data.count, 4);
  }
);
