import { exec } from 'node:child_process';
import * as path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

const getOptions = () => ({
  env: {
    ...process.env,
    OPENFN_REPO_DIR: path.resolve('repo'),
  },
});

const mapOpenFnPath = (cmd) => {
  if (!isProd) {
    return cmd.replace(/^openfn/, 'pnpm -C ../../packages/cli openfn');
  }
  return cmd;
};

const run = async (
  cmd: string
): Promise<{ stdout: string; stderr?: string; err?: any }> => {
  return new Promise((resolve) => {
    exec(mapOpenFnPath(cmd), getOptions(), (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
  });
};

export const clean = async () =>
  new Promise<void>((resolve) => {
    exec(mapOpenFnPath('openfn repo clean -f'), getOptions(), () => resolve());
  });

export default run;
