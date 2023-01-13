import test from 'ava';
import { fstat, readFileSync, writeFileSync } from 'node:fs';
import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import run from '../src/run';

const jobsPath = path.resolve('jobs');
const tmpPath = path.resolve('tmp');

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

const getOutput = (pathToJson?: string) => {
  if (!pathToJson) {
    pathToJson = path.resolve('jobs', 'output.json');
  }
  const data = readFileSync(pathToJson, 'utf8');
  return JSON.parse(data);
};

test.serial(`openfn ${jobsPath}/simple.js -ia common`, async (t) => {
  await run(t.title);

  const out = getOutput();
  t.is(out, 42);
});

// Auto-install not needed here because common was installed in the previous test
test.serial(
  `openfn ${jobsPath}/simple.js -a @openfn/language-common`,
  async (t) => {
    await run(t.title);

    const out = getOutput();
    t.is(out, 42);
  }
);

test.serial(
  `openfn ${jobsPath}/simple.js -a common -o ${tmpPath}/o.json`,
  async (t) => {
    await run(t.title);

    const out = getOutput(`${tmpPath}/o.json`);
    t.is(out, 42);
  }
);

test.serial(`openfn ${jobsPath}/simple.js -a common -O`, async (t) => {
  const { stdout } = await run(t.title);

  await t.throws(() => getOutput());
  t.regex(stdout, /Result:/);
  t.regex(stdout, /42/);
});

test.serial(
  `openfn ${jobsPath}/simple.js -a @openfn/language-common -s ${tmpPath}/state.json`,
  async (t) => {
    await writeFileSync(`${tmpPath}/state.json`, '{ "data": 2 }');
    await run(t.title);

    const out = getOutput();
    t.is(out, 4);
  }
);

test.serial(
  `openfn ${jobsPath}/simple.js -a @openfn/language-common -S "{ \\"data\\": 6 }"`,
  async (t) => {
    await run(t.title);

    const out = getOutput();
    t.is(out, 12);
  }
);

test.serial(
  `openfn ${jobsPath}/chuck.js -ia @openfn/language-http`,
  async (t) => {
    await run(t.title);

    const out = getOutput();
    t.truthy(out.data.value);
    t.regex(out.data.value, /chuck norris/i);
  }
);
