import { exec } from 'node:child_process';
import * as path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

const run = async (
  cmd: string
): Promise<{ stdout: string; stderr?: string }> => {
  if (!isProd) {
    cmd = cmd.replace(/^openfn/, 'pnpm -C ../../packages/cli openfn');
  }
  return new Promise((resolve) => {
    const options = {
      env: {
        ...process.env,
        OPENFN_REPO_DIR: path.resolve('repo'),
      },
    };
    exec(cmd, options, (err, stdout, stderr) => {
      resolve({ stdout, stderr });
    });
  });
};

export default run;
