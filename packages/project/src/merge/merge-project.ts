import { defaultsDeep, isEmpty } from 'lodash-es';

import { Project } from '../Project';
import { mergeWorkflows } from './merge-workflow';
import mapUuids from './map-uuids';
import baseMerge from '../util/base-merge';
import getDuplicates from '../util/get-duplicates';
import Workflow from '../Workflow';

export const SANDBOX_MERGE = 'sandbox';

export const REPLACE_MERGE = 'replace';

export class UnsafeMergeError extends Error {}

export type MergeProjectOptions = {
  workflowMappings: Record<string, string>; // <source, target>
  removeUnmapped: boolean;
  force: boolean;
  mode: typeof SANDBOX_MERGE | typeof REPLACE_MERGE;
};

const defaultOptions: MergeProjectOptions = {
  workflowMappings: {},
  removeUnmapped: false,
  force: true,
  /**
   * If mode is sandbox, basically only content will be merged and all metadata/settings/options/config is ignored
   * If mode is replace, all properties on the source will override the target (including UUIDs, name)
   */
  mode: SANDBOX_MERGE,
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
export function merge(
  source: Project,
  target: Project,
  opts?: Partial<MergeProjectOptions>
) {
  const options = defaultsDeep(
    opts,
    defaultOptions
  ) as Required<MergeProjectOptions>;

  // check whether multiple workflows are merging into one. throw Error
  const dupTargetMappings = getDuplicates(
    Object.values(options.workflowMappings ?? {})
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

  // mergeability
  const potentialConflicts: Record<string, string> = {};
  for (const sourceWorkflow of sourceWorkflows) {
    const targetId =
      options.workflowMappings?.[sourceWorkflow.id] ?? sourceWorkflow.id;
    const targetWorkflow = target.getWorkflow(targetId);
    if (targetWorkflow && !sourceWorkflow.canMergeInto(targetWorkflow)) {
      potentialConflicts[sourceWorkflow.id] = targetWorkflow?.id;
    }
  }

  if (Object.keys(potentialConflicts).length && !options?.force) {
    throw new UnsafeMergeError(
      `The below workflows can't be merged directly without losing data\n${Object.entries(
        potentialConflicts
      )
        .map(([from, to]) => `${from} → ${to}`)
        .join('\n')}\nPass --force to force the merge anyway`
    );
  }

  for (const sourceWorkflow of sourceWorkflows) {
    const targetId =
      options.workflowMappings?.[sourceWorkflow.id] ?? sourceWorkflow.id;
    const targetWorkflow = target.getWorkflow(targetId);

    if (targetWorkflow) {
      usedTargetIds.add(targetWorkflow.id);
      const mappings = mapUuids(sourceWorkflow, targetWorkflow);
      finalWorkflows.push(
        // @ts-ignore
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

  // Work out what metadata to preserve from the target
  // in the merge
  const assigns =
    options.mode === SANDBOX_MERGE
      ? {
          workflows: finalWorkflows,
        }
      : {
          workflows: finalWorkflows,
          openfn: {
            ...target.openfn,
            ...source.openfn,
          },
          options: {
            ...target.options,
            ...source.options,
          },
          name: source.name ?? target.name,
          description: source.description ?? target.description,
          credentials: source.credentials ?? target.credentials,
          collections: source.collections ?? target.collections,
        };

  // with project level props merging, target goes into source because we want to preserve the target props.
  return new Project(
    baseMerge(target, source, ['collections'], assigns as any)
  );
}
