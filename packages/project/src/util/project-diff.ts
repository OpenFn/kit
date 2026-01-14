import { Project } from '../Project';

export type DiffType = 'added' | 'changed' | 'removed';

export type WorkflowDiff = {
  id: string;
  type: DiffType;
};

/**
 * Compare two projects and return a list of workflow changes which would occur
 * if we go from -> to (ie, staging -> main)
 *
 * Workflows are identified by their ID and compared using version hashes.
 * The diff describes what changed going FROM the first project TO the second project.
 *
 * @param from - The baseline project to compare from
 * @param to - The comparison project to compare with
 * @returns Array of workflow diffs indicating what changed from → to:
 *   - 'added': workflow exists in `to` but not in `from`
 *   - 'removed': workflow exists in `from` but not in `to`
 *   - 'changed': workflow exists in both but has different version hashes
 *
 */
export function diff(from: Project, to: Project): WorkflowDiff[] {
  const diffs: WorkflowDiff[] = [];

  // Check all of the from project's workflows
  for (const fromWorkflow of from.workflows) {
    const toWorkflow = to.getWorkflow(fromWorkflow.id);

    if (!toWorkflow) {
      // workflow exists in from but not in to = removed
      diffs.push({ id: fromWorkflow.id, type: 'removed' });
    } else if (fromWorkflow.getVersionHash() !== toWorkflow.getVersionHash()) {
      // workflow exists in both but with different content = changed
      diffs.push({ id: fromWorkflow.id, type: 'changed' });
    }
  }

  // Check for workflows that were added in to
  for (const toWorkflow of to.workflows) {
    if (!from.getWorkflow(toWorkflow.id)) {
      // workflow exists in to but not in from = added
      diffs.push({ id: toWorkflow.id, type: 'added' });
    }
  }

  return diffs;
}
