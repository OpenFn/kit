import { exec } from 'node:child_process';
import * as path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

const options = {
  env: {
    ...process.env,
    OPENFN_REPO_DIR: path.resolve('repo'),
  },
};

const mapOpenFnPath = (cmd) => {
  if (!isProd) {
    return cmd.replace(/^openfn/, 'pnpm -C ../../packages/cli openfn');
  }
  return cmd;
};

const run = async (
  cmd: string
): Promise<{ stdout: string; stderr?: string }> => {
  return new Promise((resolve, reject) => {
    exec(mapOpenFnPath(cmd), options, (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
};

export const clean = async () =>
  new Promise<void>((resolve) => {
    exec(mapOpenFnPath('openfn repo clean -f'), options, () => resolve());
  });

export default run;
