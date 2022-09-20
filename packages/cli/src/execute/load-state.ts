import fs from 'node:fs/promises';
import type { SafeOpts } from '../util/ensure-opts';
import defaultLogger from '../util/default-logger';

export default async (opts: SafeOpts, log = defaultLogger) => {
  if (opts.stateStdin) {
    try {
      log('Reading state from stdin')
      return JSON.parse(opts.stateStdin);
    } catch(e) {
      console.error("Failed to load state from stdin")
      console.error(opts.stateStdin);
      process.exit(1);
    }
  }

  try {
    log(`Loading state from ${opts.statePath}`);
    const str = await fs.readFile(opts.statePath, 'utf8')
    return JSON.parse(str)
  } catch(e) {
    console.warn('Error loading state!');
    console.log(e);
  }
  log('Using default state')
  return {
    data: {},
    configuration: {}
  };
}