/**
 * utility to take a workflow and a credential map
 * and apply credentials to each step
 */

import { ExecutionPlan } from '@openfn/lexicon';
import { Logger } from '../util';

type JobId = string;

export type CredentialMap = Record<JobId, any>;

export const CREDENTIALS_KEY = '$CREDENTIALS$';

const applyCredentialMap = (
  plan: ExecutionPlan,
  map: CredentialMap = {},
  logger?: Logger
) => {
  const stepsWithCredentialIds = plan.workflow.steps.filter(
    (step: any) =>
      (typeof step.configuration === 'string' &&
        !step.configuration.endsWith('.json')) ||
      step.configuration?.[CREDENTIALS_KEY]
  ) as { configuration: string; name?: string; id: string }[];

  const unmapped: Record<string, true> = {};

  for (const step of stepsWithCredentialIds) {
    if (typeof step.configuration === 'string') {
      const configId = step.configuration;
      if (configId in map) {
        step.configuration = map[configId];
      } else {
        unmapped[configId] = true;
        // @ts-ignore
        delete step.configuration;
      }
    } else {
      const configId = step.configuration[CREDENTIALS_KEY];
      delete step.configuration[CREDENTIALS_KEY];
      if (configId in map) {
        Object.assign(step.configuration, map[configId]);
      } else {
        unmapped[configId] = true;
      }

      if (!(configId in unmapped)) {
        logger?.debug(
          `Applied credential ${configId} to "${step.name ?? step.id}"`
        );
      }
    }
  }

  if (Object.keys(unmapped).length) {
    logger?.warn(
      `WARNING: credential IDs were found in the workflow, but values have not been provided:`
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
