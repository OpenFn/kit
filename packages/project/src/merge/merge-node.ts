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
) {
  // We probably need to vary this by the node type,
  // step or edge, but we're basically doing this

  const targetNodes: Record<string, WithMeta<Node>> = {};
  for (const targetStep of target.steps) {
    targetNodes[targetStep.openfn?.uuid || targetStep.id!] = targetStep;
  }

  const steps: Node[] = [];
  for (const sourceStep of source.steps) {
    let newNode: Node = clone(sourceStep);
    if (sourceStep.id! in mappings.nodes) {
      const preservedId = mappings.nodes[sourceStep.id!];
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

      // do a node merge
      newNode = baseMerge(targetNodes[preservedId], sourceStep, [
        'id',
        'name',
        // @ts-ignore
        'adaptor',
        'adaptors',
        'expression',
        'next',
      ]);
    } else {
      // TODO Do we need to generate a UUID here?
    }
    steps.push(newNode);
  }

  const newSource = { ...source, steps };
  return {
    ...target,
    ...newSource,
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
  };
}
