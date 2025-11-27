import { Logger } from '@openfn/logger';
import dotenv from 'dotenv';

let env: any;

export default (path?: string) => {
  env = dotenv.config({ path, override: true, debug: false, quiet: true });
  if (env.error) {
    return null;
  }
  return env.parsed;
};

export const report = (logger?: Logger) => {
  // workaround for the CLI's inner process

  let envs = [];
  if (process.env.$DOT_ENV_OVERRIDES) {
    envs = process.env.$DOT_ENV_OVERRIDES.split(',').map((s) => s.trim());
  } else {
    envs = Object.keys(env?.parsed ?? {});
  }

  if (!envs) {
    return;
  }

  if (envs.length) {
    logger?.always(`Imported ${envs.length} env vars from .env file`);
    logger?.debug('Envs set from .env: ', envs.join(', '));
  } else {
    if (env.error) {
      logger?.debug('.env not found');
    }
  }
};
