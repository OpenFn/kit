import { Workflow } from '@openfn/lexicon';
import { Project } from '../Project';
import { mergeWorkflows } from './merge-node';
import mapUuids from './map-uuids';
import baseMerge from '../util/base-merge';

type Options = {
  // workflows: string[]; // A list of workflows to merge
  workflowMappings: Record<string, string>; // <source, target>
};

/**
 * This is the main merge function
 *
 * This top level function must be highly readable and algorithmic
 *
 * It should be a reference implementation used by other tools
 *
 * Return a new project which has all the nodes and values of the
 * target, but the UUIDs of the source
 */
// TOOD what if a workflow is removed from the target?
export function merge(
  source: Project,
  target: Project,
  options: Options = { workflowMappings: {} }
) {
  const finalWorkflows: Workflow[] = [];
  const usedTargetIds = new Set<string>();

  for (const sourceWorkflow of source.workflows) {
    const mappedTargetId = options.workflowMappings?.[sourceWorkflow.id];
    const targetWorkflow = mappedTargetId
      ? target.getWorkflow(mappedTargetId)
      : target.getWorkflow(sourceWorkflow.id);

    if (targetWorkflow) {
      usedTargetIds.add(targetWorkflow.id);
      const mappings = mapUuids(sourceWorkflow, targetWorkflow);
      finalWorkflows.push(
        mergeWorkflows(sourceWorkflow, targetWorkflow, mappings)
      );
    } else {
      finalWorkflows.push(sourceWorkflow);
    }
  }

  // workflows from target that didn't get merged
  for (const targetWorkflow of target.workflows) {
    if (!usedTargetIds.has(targetWorkflow.id)) {
      finalWorkflows.push(targetWorkflow);
    }
  }

  // TODO: clarify repo preservation strategy
  // TODO: how other properties of a project are being merged.

  // with project level props merging, target goes into source because we want to preserve the target props.
  return new Project(
    baseMerge(target, source, [], { workflows: finalWorkflows })
  );
}
