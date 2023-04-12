import fs from 'node:fs/promises';
import type { Logger } from '@openfn/logger';
import type { Opts } from '../options';

export default async (
  opts: Pick<Opts, 'stateStdin' | 'statePath'>,
  log: Logger
) => {
  const { stateStdin, statePath } = opts;
  log.debug('Loading state...');
  if (stateStdin) {
    try {
      const json = JSON.parse(stateStdin);
      log.success('Read state from stdin');
      log.debug('state:', json);
      return json;
    } catch (e) {
      log.error('Failed to load state from stdin');
      log.error(stateStdin);
      log.error(e);
      process.exit(1);
    }
  }

  if (statePath) {
    try {
      const str = await fs.readFile(statePath, 'utf8');
      const json = JSON.parse(str);
      log.success(`Loaded state from ${statePath}`);
      log.debug('state:', json);
      return json;
    } catch (e) {
      log.warn(`Error loading state from ${statePath}`);
      log.warn(e);
    }
  }

  log.info(
    'No state provided - using default state { data: {}, configuration: {}'
  );
  return {
    data: {},
    configuration: {},
  };
};
