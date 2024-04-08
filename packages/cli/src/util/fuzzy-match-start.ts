import { ExecutionPlan } from '@openfn/lexicon';

export default (plan: ExecutionPlan, start?: string) => {
  if (start) {
    const { steps } = plan.workflow;
    // first, check for an exact id match
    const exact = steps.find((step) => step.id === start);
    if (exact) return exact.id;

    // next, build a list of all matching steps by name or id
    const matches: Record<string, true> = {};
    steps.forEach((step) => {
      if (step.id?.includes(start) || step.name?.includes(start)) {
        matches[step.id!] = true;
      }
    });

    // if there is only one match, we're good
    const results = Object.keys(matches);
    if (results.length === 1) {
      return results[0];
    }

    // if there are multipe matches, we must abort with error
    if (results.length > 1) {
      throw new Error('AMBIGUOUS_INPUT');
    }

    throw new Error('NOT_FOUND');
  }
};
