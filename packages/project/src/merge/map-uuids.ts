/**
 * Identify identical nodes in two projects
 *
 * this function will take two workflows
 * and it'll return a map of step and edge UUIDs in A
 * and how they map to B
 *
 * If step names stay the same, this is trivial
 */

import { Workflow } from '@openfn/lexicon';
import { Project } from '../Project';

// changing parent and changing id is probably a new node
// changing id but preserving parent should map
// adding a new node an changing the id... an we track this?

// null: this item does not exist in B
// string: this item maps to this ID in B (could be the same)
// true: this item needs a new UUID in B
type MappingRule = null | string | true;

// detecting nodes in b that were in a via heuristics
// what are the possible changes that will happen to a node.
// - change of properties (name, adaptor-type) [note: name affects id]
// - change of position (parent, children)
// - change of properties & position -> though one

// passes to pick solid nodes
// 1. properties & position match - solid node!

// passes to predict nodes
// 1. check what node was in that position originally (use parent when parent is a solid node, else use sibling if it's solid, else if all children are solid)
// 2. if the original node isn't a solid node, then it might be it. (when same parent and children)

interface Pair<T> {
  first: T,
  second: T,
}

export default (a: Workflow, b: Workflow) => {
  const mapping: Record<string, MappingRule> = {}

  const xopenFnIds = new Map<string, string>();
  const nopenFnIds = new Map<string, string>();

  const mainWorkflow = a,
    newWorkflow = b;
  // if we get here then a merge needs to happen
  const existingSteps = new Set<string>();
  const xparentsMap = new Map<string, string>();
  const xchildrenMap = new Map<string, string[]>();
  for (const xstep of mainWorkflow.steps) {
    // mark step as existing
    existingSteps.add(xstep.id);
    xopenFnIds.set(xstep.id, xstep.openfn.id || xstep.id);
    const children = Object.keys(xstep.next || {});
    // set children of the node
    xchildrenMap.set(xstep.id, children);
    // set step as parent of next nodes
    children.forEach((nextStep) => xparentsMap.set(nextStep, xstep.id));
  }

  const nparentsMap = new Map<string, string>();
  // find and mark solid nodes
  const solidNodes = new Map<string, string>();
  const decendantsCount = new Map<string, Pair<number>>()
  for (const nstep of newWorkflow.steps) {
    nopenFnIds.set(nstep.id, nstep.openfn.id || nstep.id)
    const children = Object.keys(nstep.next || {});
    children.forEach((nextStep) => nparentsMap.set(nextStep, nstep.id));
    // check for solid node using id, and position, very solid
    if (
      existingSteps.has(nstep) &&
      nparentsMap.get(nstep.id) === xparentsMap.get(nstep.id) &&
      sameChildren(xchildrenMap.get(nstep.id), children)
    ) {
      // solid nodes have, same node id, same parents and same children (no-structural change, no property change)
      solidNodes.set(nstep.id, nstep.id);
      continue;
    }
    // check for solid node, when name/id changed but position stayed same (no-structural change)
    let possibleNodes = getNodesWithParent(nparentsMap.get(nstep.id), xparentsMap);
    let found = false;
    for (const pnode of possibleNodes) {
      if (sameChildren(xchildrenMap.get(pnode), children)) {
        solidNodes.set(nstep.id, pnode);
        found = true;
        break;
      }
    }
    if (found) continue;

    // NOT VERY SOLID NODES BELOW

    // sameChildren but parent became ancestor
    let likelyNode = getNodeWithChildren(children, xchildrenMap);
    if (likelyNode) {
      const xParent = xparentsMap.get(likelyNode);
      let approxParent = nparentsMap.get(nstep.id);
      while (approxParent && xParent !== approxParent && !solidNodes.has(approxParent)) {
        approxParent = nparentsMap.get(approxParent);
      }
      if (xParent === approxParent) {
        // do something here
        solidNodes.set(nstep.id, likelyNode);
        continue;
      }
    }
  }
  // more than 50% decendants exist

  // same Children but parent got removed

  // parent changed, either removal or in-between nodes (same children)
  // child changed, either removal or in-between nodes, or additiional children (same parent)

  // go over new steps again
  // when parent is solid & 50% of children are solid then you're solid (children changed)
  // when all children are solid and parent is a ancestor then you're solid but relative to the children. (parent removed) or 50% ancestors are the same
  // 
  // first of we handle all simple mappings


  // go over each UUID of A and see if you can map it to something in B

  // What anything

  // Anything left over doesn't have a mapping in B and should be removed

  // If there's anything in B that isn;t in the map, flag it for creation
  // key - new workflow
  // value - old workflow
  // mapping is [old] -> [new]
  for(const [key, value] of solidNodes.entries()){
    mapping[xopenFnIds.get(value)] = nopenFnIds.get(key);
  }
  return mapping;
};

// if newchildren has some additional nodes, that's fine. it's the same children!
// when a node is missing, nope, not the same children
function sameChildren(mainChildren: string[], newChildren: string[]) {
  if (newChildren.length < mainChildren) return false;
  for (const child of mainChildren) {
    if (!newChildren.includes(child)) return false;
  }
  return true;
}

function getNodesWithParent(parent: string, parentsMap: Map<string, string>) {
  const matches: string[] = [];
  for (const [child, child_parent] of parentsMap.entries()) {
    if (parent === child_parent) matches.push(child as string);
  }
  return matches;
}

function getNodeWithChildren(newChildren: string[], childrenMap: Map<string, string[]>) {
  // which node has all of its children in here
  for (const [node, children] of childrenMap.entries()) {
    for (const child of children) {
      if (!newChildren.includes(child)) return;
    }
    return node as string;
  }
}

// Get an array of all UUIDS
const extractUUIDS = (p: Project) => {};
