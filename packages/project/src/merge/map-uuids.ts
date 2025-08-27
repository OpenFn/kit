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


export default (source: Workflow, target: Workflow) => {
  const mapping: Record<string, MappingRule> = {};

  // sets all nodes as not existing in target
  for (const tstep of target.steps) mapping[tstep.id] = null;

  for (const sstep of source.steps) {
    const ex = mapping[sstep.id];
    // matched nodes are mapped
    if (ex === null) mapping[sstep.id] = sstep.openfn.id || sstep.id;
    else if (ex === undefined) mapping[sstep.id] = true; // true to create id for new nodes
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

function getNodeWithChildren(
  newChildren: string[],
  childrenMap: Map<string, string[]>
) {
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
