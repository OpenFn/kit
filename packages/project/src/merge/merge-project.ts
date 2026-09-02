import { randomUUID } from 'node:crypto';
import { defaultsDeep, isEmpty } from 'lodash-es';
import { CredentialState } from '@openfn/lexicon';
import { Provisioner } from '@openfn/lexicon/lightning';
import { Project } from '../Project';
import { mergeWorkflows } from './merge-workflow';
import mapUuids from './map-uuids';
import baseMerge from '../util/base-merge';
import getDuplicates from '../util/get-duplicates';
import Workflow from '../Workflow';
import findChangedWorkflows from '../util/find-changed-workflows';
import getCredentialName from '../util/get-credential-name';

export const SANDBOX_MERGE = 'sandbox';

export const REPLACE_MERGE = 'replace';

export class UnsafeMergeError extends Error {}

export type MergeProjectOptions = {
  workflowMappings?: Record<string, string>; // <source, target>
  removeUnmapped?: boolean;
  force?: boolean;

  /**
   * If mode is sandbox, basically only content will be merged and all metadata/settings/options/config is ignored
   * If mode is replace, all properties on the source will override the target (including UUIDs, name)
   */
  mode?: typeof SANDBOX_MERGE | typeof REPLACE_MERGE;

  /**
   * If true, only workflows that have changed in the source
   * will be merged.
   */
  onlyUpdated?: boolean;
};

const defaultOptions: MergeProjectOptions = {
  workflowMappings: {},
  removeUnmapped: false,
  force: true,
  mode: SANDBOX_MERGE,
  onlyUpdated: false,
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
  opts?: MergeProjectOptions
) {
  const options = defaultsDeep(
    opts,
    defaultOptions
  ) as Required<MergeProjectOptions>;

  const finalWorkflows: Workflow[] = [];
  const usedTargetIds = new Set<string>();
  let sourceWorkflows = source.workflows;

  const noMappings = isEmpty(options.workflowMappings);

  if (options.onlyUpdated) {
    // only include workflows that have changed (since history or forked_from) in the list
    // unchanged target workflows will be added to the finalWorkflows list later
    sourceWorkflows = findChangedWorkflows(source);
  }

  if (!noMappings) {
    // check whether multiple workflows are merging into one
    const dupes = getDuplicates(Object.values(options.workflowMappings ?? {}));
    if (dupes.length) {
      throw new Error(
        `The following target workflows have multiple source workflows merging into them: ${dupes.join(
          ', '
        )}`
      );
    }

    sourceWorkflows = source.workflows.filter(
      (w) => !!options.workflowMappings[w.id]
    );
  }

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

      // Otherwise, merge these workflows, preserving UUIDs smartly
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
          credentials: replaceCredentials(
            source.credentials,
            target.credentials
          ),
          // sandbox mode merges workflow content into a different target
          // project and otherwise ignores the source's project-level
          // identity/settings (see name/description/openfn above) -
          // collections follow the same rule, so a local openfn.yaml can't
          // accidentally delete another project's real collections just by
          // not listing them.
          collections: target.collections,
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
          alias: source.alias ?? target.alias,
          description: source.description ?? target.description,

          // when mapping credentials, we prefer the UUIDs on the target
          credentials: replaceCredentials(
            source.credentials,
            target.credentials
          ),
          collections: mergeCollections(source.collections, target.collections),
          channels: source.channels ?? target.channels,
        };

  // with project level props merging, target goes into source because we want to preserve the target props.
  return new Project(
    baseMerge(target, source, ['channels'], assigns as any)
  );
}

/**
 * Diff a locally-edited list of collection names (from openfn.yaml, no ids)
 * against the collections that actually exist on the remote project (from a
 * fresh fetch, with real ids), matched by name.
 *
 * A local name with no match remotely is a new collection (gets a fresh
 * id). A remote collection with no matching local name is no longer wanted
 * and is flagged for deletion. Renaming is not supported: it's seen as a
 * delete of the old name plus a create of the new one.
 */
export function mergeCollections(
  source: string[] = [],
  target: Provisioner.Collection[] = []
): Provisioner.Collection[] {
  const targetByName = new Map(target.map((c) => [c.name, c]));
  const result: Provisioner.Collection[] = [];

  for (const name of source) {
    const existing = targetByName.get(name);
    if (existing) {
      result.push({ id: existing.id, name });
      targetByName.delete(name);
    } else {
      result.push({ id: randomUUID(), name });
    }
  }

  // anything left in targetByName was removed from the local list
  for (const remaining of Array.from(targetByName.values())) {
    result.push({ id: remaining.id, name: remaining.name, delete: true });
  }

  return result;
}

export const replaceCredentials = (
  sourceCreds: CredentialState[] = [],
  targetCreds: CredentialState[] = []
): CredentialState[] => {
  const result = [...targetCreds];

  // Build an object of existing target credential names for quick lookup
  const targetCredNames = targetCreds.reduce((acc, cred) => {
    acc[getCredentialName(cred)] = true;
    return acc;
  }, {} as Record<string, boolean>);

  // Find credentials in source that don't exist in target
  for (const sourceCred of sourceCreds) {
    const credName = getCredentialName(sourceCred);
    if (!targetCredNames[credName]) {
      // This is a new credential - add it without the source uuid
      // (a new UUID will be generated elsewhere)
      const { uuid, ...credWithoutUuid } = sourceCred;
      result.push(credWithoutUuid as CredentialState);
    }
  }

  return result;
};
