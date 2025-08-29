import { Workflow } from '@openfn/lexicon';
import { Project } from '../Project';
import { mergeWorkflows } from './merge-node';
import mapUuids from './map-uuids';

type Options = {
  workflows: string[]; // A list of workflows to merge
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
export function merge(source: Project, target: Project, options) {
  const finalWorkflows: Workflow[] = [];
  // TODO: a new workflow in the source will not be handled
  for (const workflow of target.workflows) {
    const sourceWorkflow = source.getWorkflow(workflow.id);
    if (sourceWorkflow) {
      const mappings = mapUuids(sourceWorkflow, workflow);
      finalWorkflows.push(mergeWorkflows(sourceWorkflow, workflow, mappings));
    } else finalWorkflows.push(workflow);
  }

  const mergedProject = new Project(
    { ...source, ...target, workflows: finalWorkflows },
    // TODO probably just preserve target repo?
    { ...source.repo, ...target.repo }
  );
  return mergedProject;
  // Get a list lof workflows to merge (based on options)
  // For each workflow, map source nodes (steps and edges)
  // to target nodes.
  // Note that we need to handle triggers somehow too
  // Merge the properties of each node
  // Including UUIDs
  // return a new project with the merged state
}
