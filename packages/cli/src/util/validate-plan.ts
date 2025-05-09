import { ExecutionPlan, Job, Trigger, WorkflowOptions } from '@openfn/lexicon';
import { Logger } from '@openfn/logger';

const assertWorkflowStructure = (plan: ExecutionPlan, logger: Logger) => {
  const { workflow, options } = plan;

  if (!workflow || typeof workflow !== 'object') {
    throw new Error(`Missing or invalid "workflow" key in execution plan`);
  }

  if (!Array.isArray(workflow.steps)) {
    throw new Error('The workflow.steps key must be an array');
  }

  if (workflow.steps.length === 0) {
    logger.warn('The workflow.steps array is empty');
  }

  workflow.steps.forEach((step, index) => {
    assertStepStructure(step, index);
  });

  assertOptionsStructure(options, logger);
};

// TODO do we really need this stuff? I'm not wild about it
// It is useful for manual workflow construction
// skipped for now just while I get things working
const assertStepStructure = (step: Job | Trigger, index: number) => {
  return;

  const allowedKeys = [
    'id',
    'name',
    'next',
    'previous',
    'adaptors',
    'expression',
    'state',
    'configuration',
    'linker',
  ];

  for (const key in step) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Invalid key "${key}" in step ${step.id || index}`);
    }
  }

  if ((step as Job).adaptors?.length && !('expression' in step)) {
    throw new Error(
      `Step ${step.id ?? index} with an adaptor must also have an expression`
    );
  }
};

const assertOptionsStructure = (
  options: WorkflowOptions = {},
  logger: Logger
) => {
  const allowedKeys = ['timeout', 'stepTimeout', 'start', 'end', 'sanitize'];

  for (const key in options) {
    if (!allowedKeys.includes(key)) {
      logger.warn(`Unrecognized option "${key}" in options object`);
    }
  }
};

export default assertWorkflowStructure;
