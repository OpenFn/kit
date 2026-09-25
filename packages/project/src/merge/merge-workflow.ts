/**
 * This function merges a step or edge
 *
 * Not sure how to handle edges yet because they're not
 * modelled quite so easy
 * Probably we have to consider a refactor to make
 * edges a bit less weird in the Project
 */

import { MappingResults } from './map-uuids';
import baseMerge from '../util/base-merge';
import Workflow, { WithMeta } from '../Workflow';

type Node = Workflow['steps'][number];

const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

// TODO merge needs to include openfn props and eg lock_version
export function mergeWorkflows(
  source: Workflow,
  target: Workflow,
  mappings: MappingResults
): Workflow {
  // We probably need to vary this by the node type,
  // step or edge, but we're basically doing this

  const targetNodes: Record<string, WithMeta<Node>> = {};
  for (const targetStep of target.steps) {
    targetNodes[targetStep.openfn?.uuid || targetStep.id!] = targetStep;
  }

  // track which target steps get claimed by a source step, so steps left
  // unclaimed afterwards can be identified as removed locally
  const matchedTargetKeys = new Set<string>();

  const steps: Node[] = [];
  for (const sourceStep of source.steps) {
    let newNode: Node = clone(sourceStep);
    if (sourceStep.id! in mappings.nodes) {
      const preservedId = mappings.nodes[sourceStep.id!];
      matchedTargetKeys.add(String(preservedId));
      const toNodeIds = Object.keys(
        typeof sourceStep.next === 'string'
          ? { [sourceStep.next]: true }
          : sourceStep.next || {}
      );
      for (const toNode of toNodeIds) {
        // find step - toNode
        const key = sourceStep.id + '-' + toNode;
        if (key in mappings.edges) {
          const preservedEdgeId = mappings.edges[key];
          // @ts-ignore
          const edge = sourceStep.next?.[toNode] || {};

          // @ts-ignore
          sourceStep.next[toNode] = {
            ...edge,
            openfn: Object.assign({}, edge?.openfn, {
              uuid: preservedEdgeId,
            }),
          };
        }
      }

      newNode = baseMerge(targetNodes[preservedId], sourceStep, [
        'id',
        'name',
        'adaptor',
        'expression',
        'next',
        'configuration',
      ]);
    } else {
      // TODO Do we need to generate a UUID here?
    }
    steps.push(newNode);
  }

  // Identify steps and edges for removal (ie, present in target but not in source)
  const removedStepIds: string[] = [];
  const removedEdges: Array<[string, string]> = [];
  for (const targetStep of target.steps) {
    const key = String(targetStep.openfn?.uuid || targetStep.id!);
    if (!matchedTargetKeys.has(key)) {
      steps.push(clone(targetStep));
      removedStepIds.push(targetStep.id!);
      for (const next in (targetStep as any).next ?? {}) {
        removedEdges.push([targetStep.id!, next]);
      }
    }
  }

  const newSource = { ...source, steps };
  const merged = new Workflow({
    ...target,
    ...newSource,
    history: source.history ?? target.history,
    openfn: {
      ...target.openfn,
      ...source.openfn,
      // preserving the target uuid. we might need a proper helper function for this
      uuid: target.openfn?.uuid,
    },
    options: {
      ...target.options,
      ...source.options,
    },
  } as any);

  for (const id of removedStepIds) {
    merged.remove(id);
  }
  for (const [from, to] of removedEdges) {
    merged.remove(from, to);
  }

  return merged;
}
