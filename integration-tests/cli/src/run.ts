import { exec } from 'node:child_process';
import * as path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

const getOptions = (env = {}) => ({
  env: {
    // there's nobody to answer a prompt (a test can override this)
    OPENFN_NO_CONFIRM: 'true',
    ...process.env,
    ...env,
    OPENFN_REPO_DIR: path.resolve('repo'),
    // workspaces live inside the kit git repo: don't pick up its branch
    OPENFN_BRANCH: 'false',
  },
});

const mapOpenFnPath = (cmd) => {
  if (!isProd) {
    return cmd.replace(
      /^openfn/,
      'node --no-warnings ../../packages/cli/dist/index.js'
    );
  }
  return cmd;
};

const run = async (
  cmd: string,
  // extra environment variables for this command only
  env?: Record<string, string>
): Promise<{ stdout: string; stderr?: string; err?: any }> => {
  return new Promise((resolve) => {
    exec(mapOpenFnPath(cmd), getOptions(env), (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
  });
};

export const clean = async () =>
  new Promise<void>((resolve) => {
    exec(mapOpenFnPath('openfn repo clean -f'), getOptions(), () => resolve());
  });

export default run;
