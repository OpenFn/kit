import { ExecutionPlan, Job } from '@openfn/lexicon';

const expand = (name: string) => {
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

type ArrayOrPlan<T> = T extends string[] ? string[] : ExecutionPlan;

// TODO typings here aren't good,I can't get this to work!
// At least this looks nice externally
export default <T extends Array<string> | ExecutionPlan>(
  input: T
): ArrayOrPlan<T> => {
  if (Array.isArray(input)) {
    return input?.map(expand) as any;
  }

  const plan = input as ExecutionPlan;
  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as Job;
    job.adaptors = job.adaptors.map(expand);
  });

  return plan as any;
};
