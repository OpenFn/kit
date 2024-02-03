import { ExecutionPlan, Job } from '@openfn/lexicon';

const getAutoinstallTargets = (plan: ExecutionPlan) => {
  const adaptors = {} as Record<string, true>;
  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    // Do not autoinstall adaptors with a path
    if (job.adaptor && !/=/.test(job.adaptor)) {
      adaptors[job.adaptor] = true;
    }
  });
  return Object.keys(adaptors);
};

export default getAutoinstallTargets;
