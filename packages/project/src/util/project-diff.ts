import { isEqual } from 'lodash-es';
import { Project } from '../Project';
import { toResourceChannels } from './resources';

export type DiffType = 'added' | 'changed' | 'removed';

export type WorkflowDiff = {
  id: string;
  type: DiffType;
};

export type ChannelDiff = {
  id: string;
  name: string;
  type: DiffType;
  // for 'changed', each field that differs
  changes?: Record<string, { from: unknown; to: unknown }>;
};

export type ProjectDiff = {
  workflows: WorkflowDiff[];
  resources: {
    channels: ChannelDiff[];
  };
};

/**
 * Compare two projects and return the changes showing how
 * project B has diverged from project A.
 *
 * Workflows are identified by their ID and compared using version hashes.
 *
 * @param a - The baseline project (e.g., main branch)
 * @param b - The comparison project (e.g., staging branch)
 * Channels are compared by their resources.yaml id. If either project has no
 * channels defined (undefined) they are not managed, so no channel changes are
 * reported.
 *
 * @returns An object with `workflows` and `resources` indicating how B differs
 * from A. Each workflow diff is:
 *   - 'added': workflow exists in B but not in A
 *   - 'removed': workflow exists in A but not in B
 *   - 'changed': workflow exists in both but has different version hashes
 *
 * @example
 * ```typescript
 * const main = await Project.from('fs', { root: '.' });
 * const staging = await Project.from('state', stagingState);
 * const { workflows } = diff(main, staging);
 * // Shows how staging has diverged from main
 * ```
 */
export function diff(
  a: Project,
  b: Project,
  // only consider these workflows
  workflows?: string[]
): ProjectDiff {
  const diffs: WorkflowDiff[] = [];

  // Check all of project A's workflows
  for (const workflowA of a.workflows) {
    if (workflows?.length && !workflows.includes(workflowA.id)) {
      continue;
    }

    const workflowB = b.getWorkflow(workflowA.id);

    if (!workflowB) {
      // workflow exists in A but not in B = removed
      diffs.push({ id: workflowA.id, type: 'removed' });
    } else if (workflowA.getVersionHash() !== workflowB.getVersionHash()) {
      // workflow exists in both but with different content = changed
      diffs.push({ id: workflowA.id, type: 'changed' });
    }
  }

  // Check for workflows that were added in B
  for (const workflowB of b.workflows) {
    if (workflows?.length && !workflows.includes(workflowB.id)) {
      continue;
    }

    if (!a.getWorkflow(workflowB.id)) {
      // workflow exists in B but not in A = added
      diffs.push({ id: workflowB.id, type: 'added' });
    }
  }

  return { workflows: diffs, resources: { channels: diffChannels(a, b) } };
}

const diffChannels = (a: Project, b: Project): ChannelDiff[] => {
  if (!a.channels || !b.channels) {
    return [];
  }

  const channelsA = toResourceChannels(a.channels, a.credentials);
  const channelsB = toResourceChannels(b.channels, b.credentials);
  const diffs: ChannelDiff[] = [];

  for (const id in channelsA) {
    if (!(id in channelsB)) {
      diffs.push({ id, name: channelsA[id].name, type: 'removed' });
    } else if (!isEqual(channelsA[id], channelsB[id])) {
      const changes: ChannelDiff['changes'] = {};
      const from: Record<string, unknown> = channelsA[id];
      const to: Record<string, unknown> = channelsB[id];
      for (const key of Object.keys({ ...from, ...to })) {
        if (!isEqual(from[key], to[key])) {
          changes[key] = { from: from[key], to: to[key] };
        }
      }
      diffs.push({ id, name: channelsB[id].name, type: 'changed', changes });
    }
  }
  for (const id in channelsB) {
    if (!(id in channelsA)) {
      diffs.push({ id, name: channelsB[id].name, type: 'added' });
    }
  }
  return diffs;
};
