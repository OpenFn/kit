import test from 'ava';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import run from './helpers/run';

const jobsPath = 'src/jobs';

// Note that these tests are STATEFUL
// Ensure the repo is clean and clear before these tests run
test.before(async () => {
  await run('openfn repo clean -f --log none');
});

test.afterEach(async () => {
  await rm('src/jobs/output.json');
});

const getOutput = (name = 'output.json') => {
  const data = readFileSync(path.resolve(`${jobsPath}/${name}`), 'utf8');
  return JSON.parse(data);
};

test.serial(`openfn ${jobsPath}/simple.js -ia common`, async (t) => {
  await run(t.title);

  const out = getOutput('output.json');
  t.is(out, 42);
});

// Auto-install not needed here because common was installed in the previosu test
test.serial(
  `openfn ${jobsPath}/simple.js -a @openfn/language-common`,
  async (t) => {
    await run(t.title);

    const out = getOutput();
    t.is(out, 42);
  }
);

test.serial(
  `openfn ${jobsPath}/chuck-norris.js -ia @openfn/language-http`,
  async (t) => {
    await run(t.title);

    const out = getOutput();
    t.truthy(out.data.value);
    t.regex(out.data.value, /chuck norris/i);
  }
);
