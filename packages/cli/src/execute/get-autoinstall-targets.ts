import { ExecutionPlan, Job } from '@openfn/lexicon';

const getAutoinstallTargets = (plan: ExecutionPlan) => {
  const adaptors = {} as Record<string, true>;
  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    // Do not autoinstall adaptors with a path
    job.adaptors
      ?.filter((adaptor) => !/=/.test(adaptor))
      .forEach((adaptor) => {
        adaptors[adaptor] = true;
      });
  });
  return Object.keys(adaptors);
};

export default getAutoinstallTargets;
