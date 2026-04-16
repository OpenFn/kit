import c from 'chalk';
import Project, { generateStepDiff, generateEdgeDiff } from '@openfn/project';
import type { StepChange, EdgeChange } from '@openfn/project';
import type { Logger } from '../util/logger';

export { generateStepDiff, generateEdgeDiff };
export type { StepChange, EdgeChange };

const printEdgeDiff = (edges: EdgeChange[], logger: Logger) => {
  for (const edge of edges) {
    if (edge.type === 'added') {
      logger.always(c.green(`    ${edge.id}: added`));
    } else if (edge.type === 'removed') {
      logger.always(c.red(`    ${edge.id}: removed`));
    } else if (edge.type === 'changed' && edge.changes) {
      logger.always(c.yellow(`    ${edge.id}:`));
      const { condition, label, enabled } = edge.changes;
      if (condition)
        logger.always(
          c.yellow(
            `      - condition: ${condition.from ?? 'none'} -> ${
              condition.to ?? 'none'
            }`
          )
        );
      if (label)
        logger.always(
          c.yellow(
            `      - label: "${label.from ?? ''}" -> "${label.to ?? ''}"`
          )
        );
      if (enabled)
        logger.always(
          c.yellow(`      - enabled: ${enabled.from} -> ${enabled.to}`)
        );
    }
  }
};

const printStepDiff = (steps: StepChange[], logger: Logger) => {
  for (const step of steps) {
    if (step.type === 'added') {
      logger.always(c.green(`    ${step.name}: added`));
    } else if (step.type === 'removed') {
      logger.always(c.red(`    ${step.name}: removed`));
    } else if (step.type === 'changed' && step.changes) {
      logger.always(c.yellow(`    ${step.name}:`));
      for (const key in step.changes) {
        if (key === 'body') {
          logger.always(c.yellow(`      - expression: ${step.changes[key]}`));
        } else {
          logger.always(
            c.yellow(
              `      - ${key}: "${step.changes[key].from}" -> "${step.changes[key].to}"`
            )
          );
        }
      }
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

  logger.break();
  logger.always('This will make the following changes to the remote project:');
  logger.break();

  if (removed.length > 0) {
    for (const diff of removed) {
      const wf = remote.getWorkflow(diff.id);
      const label = wf?.name || diff.id;
      logger.always(c.red(`${label}: deleted`));
    }
    logger.break();
  }

  if (changed.length > 0) {
    for (const diff of changed) {
      const localWf = local.getWorkflow(diff.id);
      const remoteWf = remote.getWorkflow(diff.id);
      const label = localWf?.name || diff.id;
      logger.always(c.yellow(`${label}: changed`));
      printStepDiff(generateStepDiff(localWf, remoteWf), logger);
      printEdgeDiff(generateEdgeDiff(localWf, remoteWf), logger);
    }
    logger.break();
  }

  if (added.length > 0) {
    for (const diff of added) {
      const wf = local.getWorkflow(diff.id);
      const label = wf?.name || diff.id;
      logger.always(c.green(`${label}: added`));
    }
    logger.break();
  }

  return diffs;
};
