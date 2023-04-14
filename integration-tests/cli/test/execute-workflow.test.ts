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
