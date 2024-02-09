import { ExecutionPlan, Job } from '@openfn/lexicon';

export default async (
  plan: ExecutionPlan,
  loader: (id: string) => Promise<any>
) => {
  const loaders: Promise<void>[] = [];

  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    if (typeof job.configuration === 'string') {
      loaders.push(
        new Promise(async (resolve) => {
          job.configuration = await loader(job.configuration as string);
          resolve();
        })
      );
    }
  });

  await Promise.all(loaders);
  return plan;
};
