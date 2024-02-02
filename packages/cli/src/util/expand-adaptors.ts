import { ExecutionPlan, Job } from '@openfn/lexicon';

const expand = (name: any) => {
  if (typeof name === 'string') {
    const [left] = name.split('=');
    // don't expand adaptors which look like a path (or @openfn/language-)
    if (left.match('/') || left.endsWith('.js')) {
      return name;
    }
    return `@openfn/language-${name}`;
  }
  return name;
};

export default (input: string[] | ExecutionPlan) => {
  if (Array.isArray(input)) {
    return input?.map(expand) as string[];
  }

  const plan = input as ExecutionPlan;
  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    if (job.adaptor) {
      job.adaptor = expand(job.adaptor);
    }
  });

  return plan;
};
