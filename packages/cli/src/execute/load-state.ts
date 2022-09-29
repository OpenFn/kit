import fs from 'node:fs/promises';
import type { SafeOpts } from '../util/ensure-opts';
import defaultLogger from '../util/default-logger';

export default async (opts: SafeOpts, log = defaultLogger) => {
  log.debug('Load state...')
  if (opts.stateStdin) {
    try {
      const json = JSON.parse(opts.stateStdin);
      log.success('Read state from stdin');
      log.debug('state:', json);
      return json;
    } catch(e) {
      log.error("Failed to load state from stdin")
      log.error(opts.stateStdin);
      log.error(e)
      process.exit(1);
    }
  }

  try {
    const str = await fs.readFile(opts.statePath, 'utf8')
    const json = JSON.parse(str)
    log.success(`Loaded state from ${opts.statePath}`);
    log.debug('state:', json)
    return json;
  } catch(e) {
    log.warn(`Error loading state from ${opts.statePath}`);
    log.warn(e);
  }
  log.warn('Using default state { data: {}, configuration: {}')
  return {
    data: {},
    configuration: {}
  };
}