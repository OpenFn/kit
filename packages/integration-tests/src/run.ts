import { exec } from 'node:child_process';
import * as path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

console.log();
console.log('== openfn CLI integration tests ==\n');
if (isProd) {
  console.log('Running tests in Production mode');
  console.log('Tests will use the global openfn command');
} else {
  console.log('Running tests in dev mode');
  console.log('Tests will use the local build in kit/packages/cli');
}
console.log();

const run = async (args) => {
  const exe = isProd
    ? // In production, use the global
      'openfn'
    : // But in dev, use this repo's CLI
      'pnpm -C packages/cli openfn';

  const cmd = `${exe} ${args}`;
  return new Promise((resolve) => {
    const options = {
      cwd: isProd ? '.' : path.resolve('../..'),
    };
    exec(cmd, options, (err, stdout, stderr) => {
      resolve({ stdout, stderr });
    });
  });
};

export default run;
