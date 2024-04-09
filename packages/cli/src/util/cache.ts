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
    // const step = plan.workflow.steps.find(({ id }) => id === stepId);

    // TODO do we really want to use step name? it's not likely to be easily typeable
    // Then again, for Lightning steps, the id isn't friendly either
    // const fileName = step?.name ?? stepId;
    const fileName = stepId;
    return path.resolve(`${basePath}/${fileName.replace(/ /, '-')}.json`);
  }
  return path.resolve(basePath);
};

// TODO this needs to move out into a util or something
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

    logger.info(`Writing ${stepId} output to ${cachePath}`);
    fs.writeFileSync(cachePath, JSON.stringify(output));
  }
};
