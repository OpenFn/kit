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

type Node = Workflow['steps'][number];

// Do we need mergeEdge, mergeTrigger and mergeStep?
// Or can we do it in one generic function?
// only called with objects
export function mergeNode(source, target) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      if (!Array.isArray(target[key])) result[key] = value;
      else result[key] = [...new Set([...value, target[key]])];
    } else if (
      value &&
      typeof value === 'object' &&
      target[key] &&
      typeof target[key] == 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = mergeNode(value, target[key]);
    } else {
      result[key] = value;
    }
  }
  return result;
}

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
    if (typeof mappings.nodes[sstep.id] === 'string') {
      const preservedId = mappings.nodes[sstep.id];
      // how do I merge the edges?
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
      newNode = mergeNode(sstep, targetNodes[preservedId]);
      // replace preserved id
      // newNode.openfn = { ...(newNode.openfn || {}), id: preservedId };
      newNode.openfn = Object.assign({}, newNode.openfn, { uuid: preservedId });
    } else {
      // TODO Do we need to generate a UUID here?
    }
    steps.push(newNode);
  }

  const newSource = { ...source, steps };
  return {
    ...target,
    ...newSource,
  };
}
