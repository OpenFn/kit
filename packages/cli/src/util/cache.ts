import { ExecutionPlan } from '@openfn/lexicon';
import fs from 'node:fs';
import { rmdir } from 'node:fs/promises';
import path from 'node:path'

import type { Opts } from '../options';
import { Logger } from './logger';

export const getCachePath = async (plan: ExecutionPlan, options: Pick<Opts, 'baseDir' | 'cache'>, stepId?: string) => {
  const { baseDir } = options;

  const { name } = plan.workflow;

  const basePath = `${baseDir}/.cli-cache/${name}`;
  
  if (stepId) {
    // const step = plan.workflow.steps.find(({ id }) => id === stepId);

    // TODO do we really want to use step name? it's not likely to be easily typeable
    // Then again, for Lightning steps, the id isn't friendly either
    // const fileName = step?.name ?? stepId;
    const fileName = stepId;
    return path.resolve(`${basePath}/${fileName.replace(/ /, '-')}.json`);
  }
  return path.resolve(basePath);

}

// TODO this needs to move out into a util or something
export const saveToCache = async (
  plan: ExecutionPlan,
  stepId: string,
  output: any,
  options: Pick<Opts, 'baseDir' | 'cache'>,
  logger: Logger
  ) => {
  if (options.cache) {
    const cachePath = await getCachePath(plan, options, stepId);
    // Note that this is sync because other execution order gets messed up
    fs.mkdirSync(path.dirname(cachePath), { recursive: true })

    logger.info(`Writing ${stepId} output to ${cachePath}`)
    fs.writeFileSync(cachePath, JSON.stringify(output))
  }
}

export const clearCache = async (
  plan: ExecutionPlan,
  options: Pick<Opts, 'baseDir' | 'cache'>,
  logger: Logger
) => {
  const cacheDir = await getCachePath(plan, options);

  try {
    await rmdir(cacheDir, { recursive: true })

    logger.info(`Cleared cache at ${cacheDir}`);
  } catch(e: any) {
    if (e.code === 'ENOENT') {
      // No cached files exist - this is fine, do nothing
    } else {
      logger.error(`Error while clearing cache at ${cacheDir}`)
      logger.error(e)
    }
  }
}