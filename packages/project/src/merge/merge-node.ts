/**
 * This function merges a step or edge
 *
 * Not sure how to handle edges yet because they're not
 * modelled quite so easy
 * Probably we have to consider a refactor to make
 * edges a bit less weird in the Project
 */

// Do we need mergeEdge, mergeTrigger and mergeStep?
// Or can we do it in one generic function?
export function mergeNode(source, target) {
  // We probably need to vary this by the node type,
  // step or edge, but we're basically doing this
  const result = {
    ...source,
    ...target,
    openfn: source.openfn, // this is where uuids are
  };

  return result;
}
