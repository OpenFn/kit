import { ExecutionPlan } from '@openfn/lexicon';

export default (plan: ExecutionPlan, stepPattern?: string) => {
  if (stepPattern) {
    const { steps } = plan.workflow;
    // first, check for an exact id match
    const exact = steps.find((step) => step.id === stepPattern);
    if (exact) return exact.id;

    // next, build a list of all matching steps by name or id
    const matches: Record<string, true> = {};
    steps.forEach((step) => {
      if (step.id?.includes(stepPattern) || step.name?.includes(stepPattern)) {
        matches[step.id!] = true;
      }
    });

    // if there is only one match, we're good
    const results = Object.keys(matches);
    if (results.length === 1) {
      return results[0];
    }

    // if there are multiple matches, we must abort with error
    if (results.length > 1) {
      throw new Error('AMBIGUOUS_INPUT');
    }

    throw new Error('NOT_FOUND');
  }
};
