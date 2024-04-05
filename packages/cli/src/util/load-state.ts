import fs from 'node:fs/promises';

import { getCachePath } from './cache';

import type { ExecutionPlan } from '@openfn/lexicon';
import type { Logger } from '@openfn/logger';
import type { Opts } from '../options';

export default async (
  plan: ExecutionPlan,
  opts: Pick<Opts, 'baseDir' | 'stateStdin' | 'statePath' | 'cache' | 'start'>,
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

  if (opts.start && opts.cache !== false) {
    log.debug(`Attempting to load cached input state for starting step "${opts.start}"`)
    try {
      const upstreamStep = plan.workflow.steps.find((step) => opts.start! in step.next!)?.id ?? null

      if (upstreamStep) {
        log.debug(`Input step for "${opts.start}" is "${upstreamStep}"`)
        const cachedStatePath = await getCachePath(plan, opts, upstreamStep)
        log.debug('Loading cached state from', cachedStatePath)
        
        try {
          await fs.access(cachedStatePath)

          const str = await fs.readFile(cachedStatePath, 'utf8');
          const json = JSON.parse(str);
          log.success(`Loaded cached state for step "${opts.start}" from ${cachedStatePath}`)
          log.info(`  To force disable the cache, run again with --no-cache`)
          return json;
        } catch (e) {
          log.warn(`No cached state found for step "${opts.start}"`);
          log.warn('Re-run this command with --cache and without --start to rebuild the cache');
          log.break()
          // should we exit at this point?
       }
      } else {
        log.error(`Could not find an input step for step "${opts.start}"`)
      }
    } catch(e) {
      log.warn('Error loading cached state')
      log.warn(e)
    }
  }

  log.info(
    'No state provided - using default state { data: {}, configuration: {} }'
  );
  return {
    data: {},
    configuration: {},
  };
};
