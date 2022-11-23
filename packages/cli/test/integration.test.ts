import test from 'ava';
import { exec } from 'node:child_process';

test('openfn help', async (t) => {
  await new Promise<void>((resolve) => {
    exec('openfn help', (error, stdout, stderr) => {
      t.regex(stdout, /Run an openfn job/);
      t.falsy(error);
      resolve();
    });
  });
});

test('openfn test', async (t) => {
  await new Promise<void>((resolve) => {
    exec('openfn test', (error, stdout, stderr) => {
      t.regex(stdout, /Result: 42/);
      t.falsy(error);
      resolve();
    });
  });
});
