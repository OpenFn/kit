import { Project } from '../Project';

export type DiffType = 'added' | 'changed' | 'removed';

export type WorkflowDiff = {
  id: string;
  type: DiffType;
};

/**
 * Compare a target project to a source. Diffs are relative to the target.
 *
 * Ie, if the source has a workflow that the target does not, the diff is "removed"
 *
 * Workflows are identified by their ID and compared using version hashes.
 *
 * @param source - The source project (typically local/current)
 * @param target - The target project (typically remote/comparison)
 * @returns Array of workflow diffs indicating what changed between the two projects
 */
export function diff(source: Project, target: Project): WorkflowDiff[] {
  const diffs: WorkflowDiff[] = [];

  // Check all of the source project's workflows
  for (const sourceWorkflow of source.workflows) {
    const targetWorkflow = target.getWorkflow(sourceWorkflow.id);

    if (!targetWorkflow) {
      // if the workflow does not exist in the target, it's removed
      diffs.push({ id: sourceWorkflow.id, type: 'removed' });
    } else if (
      sourceWorkflow.getVersionHash() !== targetWorkflow.getVersionHash()
    ) {
      // If the version hashes are different, that's a change
      diffs.push({ id: sourceWorkflow.id, type: 'changed' });
    }
  }

  // Check for workflows that were added in the target
  for (const targetWorkflow of target.workflows) {
    if (!source.getWorkflow(targetWorkflow.id)) {
      // If the target workflow does not exist in source, it's added
      diffs.push({ id: targetWorkflow.id, type: 'added' });
    }
  }

  return diffs;
}
