import { Workflow } from '@openfn/lexicon';
import { Project } from '../Project';
import { mergeWorkflowNodes } from './merge-node';
import mapUuids from './map-uuids';

type Options = {
  workflows: string[]; // A list of workflows to merge
};

/**
 * This is the main merge function: merge source -> target
 *
 * This top level function must be highly readable and algorithmic
 *
 * It should be a reference implementation used by other tools
 *
 * Return a new project which has all the nodes and values of the
 * target, but the UUIDs of the source
 */
export function merge(source: Project, target: Project, options) {
  const finalWorkflows: Workflow[] = [];
  for (const workflow of target.workflows) {
    const sourceWorkflow = source.getWorkflow(workflow.id);
    if (sourceWorkflow) {
      const mappings = mapUuids(sourceWorkflow, workflow);
      finalWorkflows.push(
        mergeWorkflowNodes(sourceWorkflow, workflow, mappings)
      );
    } else finalWorkflows.push(workflow);
  }

  const mergedProject = new Project(
    { ...target, ...source, workflows: finalWorkflows },
    { ...target.repo, ...source.repo }
  );
  return mergedProject;
    // id map is like:
  // source id: target uuid
  // { x: uuid_main }

  // copy it
  // keep the uuid of the target
  // for each step in the source:
  //    copy it into the target
  //    remove the UUID id (actually the whole openfn object I think)
  //    from the map, set the new UUID (or generate a new one)
  // add to the new project
}
