/**
 * utility to take a workflow and a credential map
 * and apply credentials to each step
 */

import { ExecutionPlan } from '@openfn/lexicon';
import { Logger } from '../util';

type JobId = string;

export type CredentialMap = Record<JobId, any>;

const applyCredentialMap = (
  plan: ExecutionPlan,
  map: CredentialMap = {},
  logger?: Logger
) => {
  const stepsWithCredentialIds = plan.workflow.steps.filter(
    (step: any) =>
      typeof step.configuration === 'string' &&
      !step.configuration.endsWith('.json')
  ) as { configuration: string; name?: string; id: string }[];

  const unmapped: Record<string, true> = {};

  for (const step of stepsWithCredentialIds) {
    if (map[step.configuration]) {
      logger?.debug(
        `Applying credential ${step.configuration} to "${step.name ?? step.id}"`
      );
      step.configuration = map[step.configuration];
    } else {
      unmapped[step.configuration] = true;
      // @ts-ignore
      delete step.configuration;
    }
  }

  if (Object.keys(unmapped).length) {
    logger?.warn(
      `WARNING: credential IDs were found in the workflow, but values have no bene provided:`
    );
    logger?.warn('  ', Object.keys(unmapped).join(','));
    if (map) {
      logger?.warn(
        'If the workflow fails, add these credentials to the credential map'
      );
    } else {
      // TODO if running from project file this might be bad advice
      logger?.warn('Pass a credential map with --credentials');
    }
  }
};

export default applyCredentialMap;
