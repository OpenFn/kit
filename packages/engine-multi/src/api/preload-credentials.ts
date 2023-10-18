import { CompiledExecutionPlan } from '@openfn/runtime';

export default async (
  plan: CompiledExecutionPlan,
  loader: (id: string) => Promise<any>
) => {
  const loaders: Promise<void>[] = [];

  Object.values(plan.jobs).forEach((job) => {
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
