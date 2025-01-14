import { ExecutionPlan, Job, Step } from '@openfn/lexicon';

function overridePlanAdaptors(
  plan: ExecutionPlan,
  resolutions: Record<string, string>
): ExecutionPlan {
  return {
    ...plan,
    workflow: {
      ...plan.workflow,
      steps: plan.workflow.steps.map((step) => {
        if (isJob(step))
          return {
            ...step,
            adaptors: step.adaptors?.map((a) => resolutions[a] || a),
          };
        else return step;
      }),
    },
  };
}

function isJob(step: Step): step is Job {
  // @ts-ignore
  return step && typeof step.expression === 'string';
}

export default overridePlanAdaptors;
