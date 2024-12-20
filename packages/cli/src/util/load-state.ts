import fs from 'node:fs/promises';

import { getCachePath } from './cache';

import type { ExecutionPlan } from '@openfn/lexicon';
import type { Logger } from '@openfn/logger';
import type { Opts } from '../options';

export const getUpstreamStepId = (plan: ExecutionPlan, stepId: string) => {
  const upstreamStep = plan.workflow.steps.find((step) => {
    if (step.next) {
      if (typeof step.next === 'string') {
        return step.next === stepId;
      }

      return stepId in step.next || null;
    }
  });

  if (upstreamStep) {
    return typeof upstreamStep === 'string' ? upstreamStep : upstreamStep.id!;
  }
};

export default async (
  plan: ExecutionPlan,
  opts: Pick<
    Opts,
    'baseDir' | 'stateStdin' | 'statePath' | 'cacheSteps' | 'start'
  >,
  log: Logger,
  start?: string
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

  if (start) {
    log.info(
      'No state provided to CLI. Will attempt to load state from cache instead'
    );
    log.always(
      `Attempting to load cached input state for starting step "${start}"`
    );
    try {
      const upstreamStepId = getUpstreamStepId(plan, start);
      if (upstreamStepId) {
        log.debug(`Input step for "${start}" is "${upstreamStepId}"`);
        const cachedStatePath = await getCachePath(plan, opts, upstreamStepId);
        log.debug('Loading cached state from', cachedStatePath);

        try {
          await fs.access(cachedStatePath);

          const str = await fs.readFile(cachedStatePath, 'utf8');
          const json = JSON.parse(str);
          log.success(
            `Loaded cached state for step "${start}" from ${cachedStatePath}`
          );
          log.info(`  To force disable the cache, run again with --no-cache`);
          return json;
        } catch (e) {
          log.warn(`No cached state found for step "${start}"`);
          log.warn(
            'Re-run this workflow with --cache to save the output of each step'
          );
          log.break();
        }
      } else {
        log.warn(`Could not find an input step for step "${start}"`);
      }
    } catch (e) {
      log.warn('Error loading cached state');
      log.warn(e);
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
