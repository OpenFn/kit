import { ExecutionPlan } from '@openfn/lexicon';
import fs from 'node:fs';
import path from 'node:path';

import type { Opts } from '../options';
import { Logger } from './logger';

export const getCachePath = async (
  plan: ExecutionPlan,
  options: Pick<Opts, 'baseDir'>,
  stepId: string
) => {
  const { baseDir } = options;

  const { name } = plan.workflow;

  const basePath = `${baseDir}/.cli-cache/${name}`;

  if (stepId) {
    return path.resolve(`${basePath}/${stepId.replace(/ /, '-')}.json`);
  }
  return path.resolve(basePath);
};

const ensureGitIgnore = (options: any) => {
  if (!options._hasGitIgnore) {
    const ignorePath = path.resolve(
      options.baseDir,
      '.cli-cache',
      '.gitignore'
    );
    try {
      fs.accessSync(ignorePath);
    } catch (e) {
      // doesn't exist!
      fs.writeFileSync(ignorePath, '*');
    }
  }
  options._hasGitIgnore = true;
};

export const saveToCache = async (
  plan: ExecutionPlan,
  stepId: string,
  output: any,
  options: Pick<Opts, 'baseDir' | 'cacheSteps'>,
  logger: Logger
) => {
  if (options.cacheSteps) {
    const cachePath = await getCachePath(plan, options, stepId);
    // Note that this is sync because other execution order gets messed up
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    ensureGitIgnore(options);

    logger.info(`Writing ${stepId} output to ${cachePath}`);
    fs.writeFileSync(cachePath, JSON.stringify(output));
  }
};
