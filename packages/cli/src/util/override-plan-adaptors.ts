import { ExecutionPlan, Job, Step } from '@openfn/lexicon';

function overridePlanAdaptors(
  plan: ExecutionPlan,
  resolutions: Record<string, string>
): ExecutionPlan {
  const hasRes = Object.entries(resolutions).some(
    ([key, value]) => key !== value
  );

  // there's nothing to override when resolutions have the same values
  if (!hasRes) return plan;
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

export function isJob(step: Step): step is Job {
  // @ts-ignore
  return step && typeof step.expression === 'string';
}

export default overridePlanAdaptors;
