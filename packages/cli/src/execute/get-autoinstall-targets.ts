import { ExecutionPlan, Job } from '@openfn/lexicon';

const getAutoinstallTargets = (plan: ExecutionPlan) => {
  const adaptors = {} as Record<string, true>;
  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    if (job.adaptor) {
      adaptors[job.adaptor] = true;
    }
  });
  return Object.keys(adaptors);
};

export default getAutoinstallTargets;
