import { Workflow } from '@openfn/lexicon';
import defaultsDeep from 'lodash/defaultsDeep';
import isEmpty from 'lodash/isEmpty';

import { Project } from '../Project';
import { mergeWorkflows } from './merge-node';
import mapUuids from './map-uuids';
import baseMerge from '../util/base-merge';
import getDuplicates from '../util/get-duplicates';

export type MergeProjectOptions = Partial<{
  workflowMappings: Record<string, string>; // <source, target>
  removeUnmapped: boolean;

  force: boolean; // TODO not implemented yet
}>;

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
export function merge(
  source: Project,
  target: Project,
  options?: MergeProjectOptions
) {
  const defaultOptions: MergeProjectOptions = {
    workflowMappings: {},
    removeUnmapped: false,
  };
  options = defaultsDeep<MergeProjectOptions>(options, defaultOptions);

  // check whether multiple workflows are merging into one. throw Error
  const dupTargetMappings = getDuplicates(
    Object.values(options?.workflowMappings)
  );
  if (dupTargetMappings.length) {
    throw new Error(
      `The following target workflows have multiple source workflows merging into them: ${dupTargetMappings.join(
        ', '
      )}`
    );
  }

  const finalWorkflows: Workflow[] = [];
  const usedTargetIds = new Set<string>();

  const noMappings = isEmpty(options?.workflowMappings); // no mapping provided. hence *
  let sourceWorkflows: Workflow[] = source.workflows.filter((w) => {
    if (noMappings) return true;
    return !!options?.workflowMappings[w.id];
  });

  for (const sourceWorkflow of sourceWorkflows) {
    const targetId =
      options.workflowMappings?.[sourceWorkflow.id] ?? sourceWorkflow.id;
    const targetWorkflow = target.getWorkflow(targetId);

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

  // do not remove unmapped means include them too.
  if (!options?.removeUnmapped) {
    // workflows from target that didn't get merged
    for (const targetWorkflow of target.workflows) {
      if (!usedTargetIds.has(targetWorkflow.id)) {
        finalWorkflows.push(targetWorkflow);
      }
    }
  }

  // TODO: clarify repo preservation strategy
  // TODO: how other properties of a project are being merged.

  // with project level props merging, target goes into source because we want to preserve the target props.
  return new Project(
    baseMerge(target, source, ['collections'], { workflows: finalWorkflows })
  );
}
