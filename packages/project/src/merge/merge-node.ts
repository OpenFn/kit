/**
 * This function merges a step or edge
 *
 * Not sure how to handle edges yet because they're not
 * modelled quite so easy
 * Probably we have to consider a refactor to make
 * edges a bit less weird in the Project
 */

import { Workflow } from '@openfn/lexicon';

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

export function mergeWorkflowNodes(
  source: Workflow,
  target: Workflow,
  mappings: Record<string, MappingRule>
) {
  // We probably need to vary this by the node type,
  // step or edge, but we're basically doing this

  const targetNodes: Record<string, Node> = {};
  for (const tstep of target.steps)
    targetNodes[tstep.openfn.id || tstep.id] = tstep;

  const steps: Node[] = [];
  for (const sstep of source.steps) {
    let newNode: Node = sstep;
    if (typeof mappings[sstep.id] === 'string') {
      const preservedId = mappings[sstep.id];
      // do a merge
      newNode = mergeNode(sstep, targetNodes[preservedId]);
      // replace preserved id
      newNode.openfn = { ...(newNode.openfn || {}), id: preservedId };
    }
    steps.push(newNode);
  }

  const newSource = { ...source, steps };
  return {
    ...target,
    ...newSource,
  };
}
