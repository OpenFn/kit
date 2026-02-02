import { Project } from '../Project';

export type DiffType = 'added' | 'changed' | 'removed';

export type WorkflowDiff = {
  id: string;
  type: DiffType;
};

/**
 * Compare two projects and return a list of workflow changes showing how
 * project B has diverged from project A.
 *
 * Workflows are identified by their ID and compared using version hashes.
 *
 * @param a - The baseline project (e.g., main branch)
 * @param b - The comparison project (e.g., staging branch)
 * @returns Array of workflow diffs indicating how B differs from A:
 *   - 'added': workflow exists in B but not in A
 *   - 'removed': workflow exists in A but not in B
 *   - 'changed': workflow exists in both but has different version hashes
 *
 * @example
 * ```typescript
 * const main = await Project.from('fs', { root: '.' });
 * const staging = await Project.from('state', stagingState);
 * const diffs = diff(main, staging);
 * // Shows how staging has diverged from main
 * ```
 */
export function diff(a: Project, b: Project): WorkflowDiff[] {
  const diffs: WorkflowDiff[] = [];

  // Check all of project A's workflows
  for (const workflowA of a.workflows) {
    const workflowB = b.getWorkflow(workflowA.id);

    if (!workflowB) {
      // workflow exists in A but not in B = removed
      diffs.push({ id: workflowA.id, type: 'removed' });
    } else if (workflowA.getVersionHash() !== workflowB.getVersionHash()) {
      // TODO what's up with this bullshit diff?
      console.log(workflowA.getVersionHash({ sha: false }));
      console.log();
      console.log();
      console.log(workflowB.getVersionHash({ sha: false }));
      console.log();
      console.log();
      // workflow exists in both but with different content = changed
      diffs.push({ id: workflowA.id, type: 'changed' });
    }
  }

  // Check for workflows that were added in B
  for (const workflowB of b.workflows) {
    if (!a.getWorkflow(workflowB.id)) {
      // workflow exists in B but not in A = added
      diffs.push({ id: workflowB.id, type: 'added' });
    }
  }

  return diffs;
}
