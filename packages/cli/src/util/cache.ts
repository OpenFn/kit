import fs from 'node:fs';
import path from 'node:path';
import { rmdir } from 'node:fs/promises';

import type { ExecutionPlan } from '@openfn/lexicon';
import type { Opts } from '../options';
import type { Logger } from './logger';

export const getCachePath = async (
  plan: ExecutionPlan,
  options: Pick<Opts, 'baseDir'>,
  stepId?: string
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

export const clearCache = async (
  plan: ExecutionPlan,
  options: Pick<Opts, 'baseDir'>,
  logger: Logger
) => {
  const cacheDir = await getCachePath(plan, options);

  try {
    await rmdir(cacheDir, { recursive: true });

    logger.info(`Cleared cache at ${cacheDir}`);
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      // No cached files exist - this is fine, do nothing
    } else {
      logger.error(`Error while clearing cache at ${cacheDir}`);
      logger.error(e);
    }
  }
};
