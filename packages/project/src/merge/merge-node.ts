/**
 * This function merges a step or edge
 *
 * Not sure how to handle edges yet because they're not
 * modelled quite so easy
 * Probably we have to consider a refactor to make
 * edges a bit less weird in the Project
 */

import { Workflow } from '@openfn/lexicon';
import { MappingResults } from './map-uuids';
import baseMerge from '../util/base-merge';

type Node = Workflow['steps'][number];

const clone = (obj) => JSON.parse(JSON.stringify(obj));

export function mergeWorkflows(
  source: Workflow,
  target: Workflow,
  mappings: MappingResults
) {
  // We probably need to vary this by the node type,
  // step or edge, but we're basically doing this

  const targetNodes: Record<string, Node> = {};
  for (const targetStep of target.steps) {
    targetNodes[targetStep.openfn.uuid || targetStep.id] = targetStep;
  }

  const steps: Node[] = [];
  for (const sourceStep of source.steps) {
    let newNode: Node = clone(sourceStep);
    if (sourceStep.id in mappings.nodes) {
      const preservedId = mappings.nodes[sourceStep.id];
      const toNodeIds = Object.keys(
        typeof sourceStep.next === 'string'
          ? { [tstep.next]: true }
          : sourceStep.next || {}
      );
      for (const toNode of toNodeIds) {
        // find step - toNode
        const key = sourceStep.id + '-' + toNode;
        if (key in mappings.edges) {
          const preservedEdgeId = mappings.edges[key];
          const edge = sourceStep.next?.[toNode] || {};

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
        'adaptor',
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
    openfn: { ...target.openfn }, // preserving the target uuid. we might need a proper helper function for this.
  };
}
