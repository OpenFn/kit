import fs from 'node:fs';
import path from 'node:path';
import { rmdir } from 'node:fs/promises';

import type { ExecutionPlan } from '@openfn/runtime';
import type { Opts } from '../options';
import type { Logger } from './logger';

export const CACHE_DIR = '.cli-cache';

// When called without workflowName/stepId, returns the CACHE_DIR root.
// This is used directly in saveToCache to locate the .gitignore.
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

  // path.resolve throws on undefined, so filter it out; when workflowName
  // is absent the path resolves to the bare CACHE_DIR root.
  const basePath = path.resolve(
    ...([baseDir ?? process.cwd(), CACHE_DIR, workflowName].filter(
      Boolean
    ) as string[])
  );

  if (stepId) {
    return `${basePath}/${stepId.replace(/ /, '-')}.json`;
  }
  return basePath;
};

const ensureGitIgnore = (options: any, cacheRoot: string) => {
  if (!options._hasGitIgnore) {
    const ignorePath = path.join(cacheRoot, '.gitignore');
    try {
      fs.accessSync(ignorePath);
    } catch (e) {
      // doesn't exist!
      fs.writeFileSync(ignorePath, '*');
    }
    options._hasGitIgnore = true;
  }
};

export const saveToCache = async (
  plan: ExecutionPlan,
  stepId: string,
  output: any,
  options: Pick<Opts, 'baseDir' | 'cachePath' | 'cacheSteps'>,
  logger: Logger
) => {
  if (options.cacheSteps) {
    const cachePath = getCachePath(options, plan.workflow.name, stepId);
    // Note that this is sync because other execution order gets messed up
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    // getCachePath with no workflowName returns the CACHE_DIR root
    ensureGitIgnore(options, getCachePath(options));

    logger.info(`Writing ${stepId} output to ${cachePath}`);
    fs.writeFileSync(cachePath, JSON.stringify(output));
  }
};

export const clearCache = async (
  plan: ExecutionPlan,
  options: Pick<Opts, 'baseDir' | 'cachePath'>,
  logger: Logger
) => {
  const cacheDir = getCachePath(options, plan.workflow?.name);

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
