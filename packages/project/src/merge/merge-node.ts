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

export function mergeWorkflows(
  source: Workflow,
  target: Workflow,
  mappings: MappingResults
) {
  // We probably need to vary this by the node type,
  // step or edge, but we're basically doing this

  const targetNodes: Record<string, Node> = {};
  for (const tstep of target.steps)
    targetNodes[tstep.openfn.uuid || tstep.id] = tstep;
  const steps: Node[] = [];
  for (const sstep of source.steps) {
    let newNode: Node = sstep;
    if (sstep.id in mappings.nodes) {
      const preservedId = mappings.nodes[sstep.id];
      const preservedEdgeIds = {};
      for (const toNode of Object.keys(
        typeof sstep.next === 'string'
          ? { [tstep.next]: true }
          : sstep.next || {}
      )) {
        // find step - toNode
        const key = sstep.id + '-' + toNode;
        if (typeof mappings.edges[key] === 'string') {
          const preservedEdgeId = mappings.edges[key];
          const toEdge = sstep.next?.[toNode] || {};
          preservedEdgeIds[toNode] = sstep.next[toNode] = {
            ...toEdge,
            openfn: { ...(toEdge?.openfn || {}), uuid: preservedEdgeId },
          };
        }
      }

      // do a node merge
      // it's a bit tricky knowing all the properties to be merged
      newNode = baseMerge(targetNodes[preservedId], sstep, [
        'id',
        'name',
        'adaptor',
        'expression',
        'next',
        'previous',
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
