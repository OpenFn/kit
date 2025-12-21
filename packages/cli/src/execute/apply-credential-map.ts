/**
 * utility to take a workflow and a credential map
 * and apply credentials to each step
 */

import { ExecutionPlan, Job } from '@openfn/lexicon';
import { Logger } from '../util';

type JobId = string;

export type CredentialMap = Record<JobId, any>;

const applyCredentialMap = (
  plan: ExecutionPlan,
  map: CredentialMap = {},
  logger?: Logger
) => {
  const steps = plan.workflow.steps.filter(
    (step: any) => typeof step.configuration === 'string'
  ) as { configuration: string; name?: string; id: string }[];

  const unmapped: Record<string, true> = {};

  for (const step of steps) {
    if (map[step.configuration]) {
      logger?.debug(
        `Applying credential ${step.configuration} to "${step.name ?? step.id}"`
      );
      step.configuration = map[step.configuration];
    }
    // TODO  if confug is a string without a mapping,
    // the job will most likely  fali
    // We should proably throw a warning at least?
    // should we also delete the key? Wht will the runtime do if
    // config i sa string?
    // probably it gets wierd, so lets delete
    else {
      unmapped[step.configuration] = true;
      // @ts-ignore
      delete step.configuration;
    }
  }

  logger?.warn(
    `WARNING: the following credential ids were not mapped and have been removed:`
  );
  logger?.warn(Object.keys(unmapped).join(','));
  if (map) {
    logger?.warn(
      'If the workflow fails, add these credentials to the credential map'
    );
  } else {
    // TODO if running from project file this might be bad advice
    logger?.warn('Pass a credential map with --credentials');
  }
};

export default applyCredentialMap;
