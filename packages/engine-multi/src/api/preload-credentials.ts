import { ExecutionPlan, Job } from '@openfn/lexicon';
import type { Logger } from '@openfn/logger';
import { CredentialErrorObj, CredentialLoadError } from '../errors';

export default async (
  plan: ExecutionPlan,
  loader: (id: string) => Promise<any>,
  logger?: Logger
) => {
  const loaders: Promise<void>[] = [];

  const errors: CredentialErrorObj[] = [];

  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    if (typeof job.configuration === 'string') {
      const config = job.configuration as string;
      loaders.push(
        new Promise(async (resolve) => {
          logger?.debug(`Loading credential ${config} for step ${job.id}`);
          try {
            job.configuration = await loader(config as string);
            logger?.debug(`Credential ${config} loaded OK (${config})`);
          } catch (e: any) {
            logger?.debug(`Error loading credential ${config}`);
            errors.push({
              id: config,
              step: step.id!,
              error: e?.message || e?.toString() || e,
            });
          }
          resolve();
        })
      );
    }
  });

  await Promise.all(loaders);
  if (errors.length) {
    throw new CredentialLoadError(errors);
  }
  return plan;
};
