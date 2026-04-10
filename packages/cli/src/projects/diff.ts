import c from 'chalk';
import Project, { generateStepDiff } from '@openfn/project';
import type { StepChange } from '@openfn/project';
import type { Logger } from '../util/logger';

export { generateStepDiff };
export type { StepChange };

const printStepDiff = (steps: StepChange[], logger: Logger) => {
  for (const step of steps) {
    if (step.type === 'added') {
      logger.always(c.green(`    ${step.name}: added`));
    } else if (step.type === 'removed') {
      logger.always(c.red(`    ${step.name}: removed`));
    } else if (step.type === 'changed' && step.changes) {
      logger.always(c.yellow(`    ${step.name}:`));
      const { name, adaptor, body } = step.changes;
      if (name)
        logger.always(c.yellow(`      - name: "${name.from}" -> "${name.to}"`));
      if (adaptor)
        logger.always(
          c.yellow(`      - adaptor: ${adaptor.from} -> ${adaptor.to}`)
        );
      if (body) logger.always(c.yellow(`      - body: ${body}`));
    }
  }
};

export const printRichDiff = (
  local: Project,
  remote: Project,
  locallyChangedWorkflows: string[],
  logger: Logger
) => {
  const diffs = remote.diff(local, locallyChangedWorkflows);
  if (diffs.length === 0) {
    logger.info('No workflow changes detected');
    return diffs;
  }

  const removed = diffs.filter((d) => d.type === 'removed');
  const changed = diffs.filter((d) => d.type === 'changed');
  const added = diffs.filter((d) => d.type === 'added');

  logger.always('This will make the following changes to the remote project:');

  if (removed.length > 0) {
    logger.break();
    for (const diff of removed) {
      const wf = remote.getWorkflow(diff.id);
      const label = wf?.name || diff.id;
      logger.always(c.red(`${label}: deleted`));
    }
  }

  if (changed.length > 0) {
    logger.break();
    for (const diff of changed) {
      const localWf = local.getWorkflow(diff.id);
      const remoteWf = remote.getWorkflow(diff.id);
      const label = localWf?.name || diff.id;
      logger.always(c.yellow(`${label}: changed`));
      printStepDiff(generateStepDiff(localWf, remoteWf), logger);
    }
  }

  if (added.length > 0) {
    logger.break();
    for (const diff of added) {
      const wf = local.getWorkflow(diff.id);
      const label = wf?.name || diff.id;
      logger.always(c.green(`${label}: added`));
    }
  }

  logger.break();
  return diffs;
};
