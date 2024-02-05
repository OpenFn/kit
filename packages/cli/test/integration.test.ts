import test from 'ava';
import { exec } from 'node:child_process';

test('openfn help', async (t) => {
  await new Promise<void>((resolve) => {
    exec('pnpm openfn help', (error, stdout, stderr) => {
      t.regex(stdout, /Run an openfn expression/);
      t.falsy(error);
      t.falsy(stderr);
      resolve();
    });
  });
});

test('openfn test', async (t) => {
  await new Promise<void>((resolve) => {
    exec('pnpm openfn test', (error, stdout, stderr) => {
      t.falsy(error);
      t.falsy(stderr);
      t.regex(stdout, /Result: 42/);
      resolve();
    });
  });
});
