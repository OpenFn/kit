import type { ExecutionPlan } from '@openfn/lexicon';

import type { ExecuteOptions } from './command';
import execute from './execute';
import serializeOutput from './serialize-output';
import getAutoinstallTargets from './get-autoinstall-targets';

import { install } from '../repo/handler';
import compile from '../compile/compile';

import { Logger, printDuration } from '../util/logger';
import loadState from '../util/load-state';
import validateAdaptors from '../util/validate-adaptors';
import loadPlan from '../util/load-plan';
import assertPath from '../util/assert-path';
import { clearCache } from '../util/cache';
import fuzzyMatchStart from '../util/fuzzy-match-start';
import abort from '../util/abort';

const executeHandler = async (options: ExecuteOptions, logger: Logger) => {
  const start = new Date().getTime();
  assertPath(options.path);
  await validateAdaptors(options, logger);

  let plan = await loadPlan(options, logger);

  if (options.cache) {
    await clearCache(plan, options, logger)
  }

  const { repoDir, monorepoPath, autoinstall } = options;
  if (autoinstall) {
    if (monorepoPath) {
      logger.warn('Skipping auto-install as monorepo is being used');
    } else {
      const autoInstallTargets = getAutoinstallTargets(plan);
      if (autoInstallTargets.length) {
        logger.info('Auto-installing language adaptors');
        await install({ packages: autoInstallTargets, repoDir }, logger);
      }
    }
  }

  try {
    const start = fuzzyMatchStart(plan, options.start) ?? options.start;
    logger.info(`Starting workflow from step "${start}"`);
    options.start = start;
  } catch (err: any) {
    let message;
    let help;
    if (err.message === 'AMBIGUOUS_INPUT') {
      message = 'Start pattern matched muliple steps';
      help =
        'The start option can contain an exact match of a step id, or a partial match if a name or id so long as it is unique.';
    } else if (err.message === 'NOT_FOUND') {
      // TOOD this error will actualy be pre-empted by plan validation
      message = 'Start step not found';
      help = `The start step (${options.start}) could not be be found in the workflow provided.`;
    } else {
      message = 'Error parsing start option';
    }
    abort(logger, `Error: ${message}`, undefined, help);
  }

  const state = await loadState(plan, options, logger);

  if (options.compile) {
    plan = (await compile(plan, options, logger)) as ExecutionPlan;
  } else {
    logger.info('Skipping compilation as noCompile is set');
  }

  try {
    const result = await execute(plan, state, options, logger);

    if (options.cacheSteps) {
      logger.success(
        'Cached output written to ./cli-cache (see info logs for details)'
      );
    }

    await serializeOutput(options, result, logger);
    const duration = printDuration(new Date().getTime() - start);
    if (result?.errors) {
      logger.warn(
        `Errors reported in ${Object.keys(result.errors).length} jobs`
      );
    }
    logger.success(`Finished in ${duration}${result?.errors ? '' : ' ✨'}`);
    return result;
  } catch (err: any) {
    if (!err.handled) {
      logger.error('Unexpected error in execution');
      logger.error(err);
    }
    const duration = printDuration(new Date().getTime() - start);
    logger.always(`Workflow failed in ${duration}.`);
    process.exitCode = 1;
  }
};

export default executeHandler;
