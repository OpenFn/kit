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
import fuzzyMatchStep from '../util/fuzzy-match-step';
import abort from '../util/abort';
import validatePlan from '../util/validate-plan';

const matchStep = (
  plan: ExecutionPlan,
  stepPattern: string,
  stepName: string,
  logger: Logger
): string => {
  try {
    return fuzzyMatchStep(plan, stepPattern) ?? stepPattern;
  } catch (err: any) {
    let message;
    let help;
    if (err.message === 'AMBIGUOUS_INPUT') {
      message = `${stepName} pattern matched multiple steps`;
      help = `The ${stepName} option can contain an exact match of a step id, or a partial match if a name or id so long as it is unique.`;
    } else if (err.message === 'NOT_FOUND') {
      message = `${stepName} step not found`;
      help = `The step "${stepPattern}" could not be be found in the workflow`;
    } else {
      message = `Error parsing ${stepName} option`;
    }
    abort(logger, `Error: ${message}`, undefined, help);
  }
  return '';
};

const executeHandler = async (options: ExecuteOptions, logger: Logger) => {
  const start = new Date().getTime();
  assertPath(options.path);
  await validateAdaptors(options, logger);

  let plan = await loadPlan(options, logger);
  validatePlan(plan, logger);

  if (options.cacheSteps) {
    await clearCache(plan, options, logger);
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

  let customStart;
  let customEnd;

  // Handle start, end and only
  if (options.only) {
    const step = matchStep(plan, options.only, 'only', logger);

    customStart = step;
    customEnd = step;
    logger.always(`Only running workflow step "${options.start}"`);
  } else {
    if (options.start) {
      customStart = matchStep(
        plan,
        options.start ?? plan.options.start,
        'start',
        logger
      );
      logger.info(`Starting workflow from step "${options.start}"`);
    }

    if (options.end) {
      customEnd = matchStep(
        plan,
        options.end ?? plan.options.end,
        'end',
        logger
      );
      logger.always(`Ending workflow at step "${options.end}"`);
    }
  }
  const state = await loadState(plan, options, logger, customStart);

  if (options.compile) {
    plan = (await compile(plan, options, logger)) as ExecutionPlan;
  } else {
    logger.info('Skipping compilation as noCompile is set');
  }

  const finalPlan = {
    ...plan,
    options: {
      ...plan.options,
      start: customStart || plan.options.start,
      end: customEnd,
    },
    workflow: plan.workflow,
  };

  try {
    const result = await execute(finalPlan, state, options, logger);

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
