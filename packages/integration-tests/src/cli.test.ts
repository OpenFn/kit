import test from 'ava';
import run from './run';

test.serial('version', async (t) => {
  const { stdout } = await run('version');
  t.regex(stdout, /Versions/);
  t.regex(stdout, /Node.js/);
  t.regex(stdout, /cli/);
  t.regex(stdout, /runtime/);
  t.regex(stdout, /compiler/);
});

test.serial('test', async (t) => {
  const { stdout } = await run('test');
  t.regex(stdout, /Versions:/);
  t.regex(stdout, /Running test job.../);
  t.regex(stdout, /Result: 42/);
});
