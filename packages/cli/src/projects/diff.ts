import c from 'chalk';
import Project, {
  generateStepDiff,
  generateEdgeDiff,
  toResourceChannels,
} from '@openfn/project';
import type { ResourceDiff } from '@openfn/project';
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

const printChannelDiff = (
  channelDiffs: ResourceDiff[],
  local: Project,
  remote: Project,
  logger: Logger
) => {
  const localChannels = toResourceChannels(local.channels, local.credentials);
  const remoteChannels = toResourceChannels(
    remote.channels,
    remote.credentials
  );

  logger.always('Channels:');
  for (const { id, type } of channelDiffs) {
    if (type === 'added') {
      logger.always(c.green(`  ${localChannels[id].name}: added`));
    } else if (type === 'removed') {
      logger.always(c.red(`  ${remoteChannels[id].name}: removed`));
    } else {
      const from: Record<string, any> = remoteChannels[id];
      const to: Record<string, any> = localChannels[id];
      logger.always(c.yellow(`  ${to.name}: changed`));
      for (const key of Object.keys({ ...from, ...to })) {
        if (from[key] !== to[key]) {
          logger.always(
            c.yellow(`    - ${key}: "${from[key] ?? ''}" -> "${to[key] ?? ''}"`)
          );
        }
      }
    }
  }
  logger.break();
};

// TODO need to include collection diffs
// https://github.com/OpenFn/kit/issues/1524
export const printRichDiff = (
  local: Project,
  remote: Project,
  locallyChangedWorkflows: string[],
  logger: Logger
) => {
  const { workflows: diffs, resources } = remote.diff(
    local,
    locallyChangedWorkflows
  );
  if (diffs.length === 0 && resources.channels.length === 0) {
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

  if (resources.channels.length > 0) {
    printChannelDiff(resources.channels, local, remote, logger);
  }

  return diffs;
};
