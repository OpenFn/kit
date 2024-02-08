import test from 'ava';
import run from '../src/run';

test.serial('openfn version', async (t) => {
  const { stdout } = await run(t.title);

  t.regex(stdout, /Versions/);
  t.regex(stdout, /node.js/);
  t.regex(stdout, /cli/);
  t.regex(stdout, /runtime/);
  t.regex(stdout, /compiler/);
});

test.serial('openfn test', async (t) => {
  const { stdout } = await run(t.title);
  t.regex(stdout, /Versions:/);
  t.regex(stdout, /Running test workflow/);
  t.regex(stdout, /Result: 42/);
});

test.serial('openfn help', async (t) => {
  const { stdout } = await run(t.title);
  t.regex(stdout, /Commands:/);
  t.regex(stdout, /Positionals:/);
  t.regex(stdout, /Options:/);
  t.regex(stdout, /Examples:/);
});
