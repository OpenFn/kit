import { Logger } from '@openfn/logger';
import dotenv from 'dotenv';

const env = dotenv.config({ override: true, debug: false, quiet: true });

export const report = (logger?: Logger) => {
  const envs = Object.keys(env.parsed ?? {});
  if (envs.length) {
    logger?.always(`Imported ${envs.length} env vars from .env file`);
    logger?.debug('Envs set from .env: ', envs.join(', '));
  } else {
    if (env.error) {
      logger?.debug('.env not found');
    }
  }
};
