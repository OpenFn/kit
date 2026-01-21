import fs from 'node:fs';
import path from 'node:path';
import { rmdir } from 'node:fs/promises';

import type { ExecutionPlan } from '@openfn/lexicon';
import type { Opts } from '../options';
import type { Logger } from './logger';

export const CACHE_DIR = '.cli-cache';

// TODO this is all a bit over complicated tbh
export const getCachePath = (
  options: Pick<Opts, 'baseDir' | 'cachePath'>,
  workflowName?: string,
  stepId?: string
) => {
  const { baseDir, cachePath } = options;
  if (cachePath) {
    if (stepId) {
      return path.resolve(cachePath, `${stepId.replace(/ /, '-')}.json`);
    }
    return path.resolve(cachePath);
  }

  const basePath = path.resolve(
    baseDir ?? process.cwd(),
    `${CACHE_DIR}/${workflowName}`
  );

  if (stepId) {
    return `${basePath}/${stepId.replace(/ /, '-')}.json`;
  }
  return basePath;
};

const ensureGitIgnore = (options: any, cachePath: string) => {
  if (!options._hasGitIgnore) {
    // Find the root cache folder
    let root = cachePath;
    while (root && !root.endsWith(CACHE_DIR)) {
      root = path.dirname(root);
    }
    // From the root cache, look for a .gitignore
    const ignorePath = path.resolve(root, '.gitignore');
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
    const cachePath = await getCachePath(options, plan.workflow.name, stepId);
    // Note that this is sync because other execution order gets messed up
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    ensureGitIgnore(options, path.dirname(cachePath));

    logger.info(`Writing ${stepId} output to ${cachePath}`);
    fs.writeFileSync(cachePath, JSON.stringify(output));
  }
};

export const clearCache = async (
  plan: ExecutionPlan,
  options: Pick<Opts, 'baseDir'>,
  logger: Logger
) => {
  const cacheDir = await getCachePath(options, plan.workflow?.name);

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
