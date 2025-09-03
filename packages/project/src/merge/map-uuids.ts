/**
 * Identify identical nodes in two projects
 *
 * this function will take two workflows
 * and it'll return a map of step and edge UUIDs in A
 * and how they map to B
 *
 * If step names stay the same, this is trivial
 */

import { Job, Workflow } from '@openfn/lexicon';
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

export interface MappingResults {
  nodes: Record<string, MappingRule>;
  edges: Record<string, MappingRule>;
}

export default (source: Workflow, target: Workflow): MappingResults => {
  // create nodes, edges
  const nodeMapping: Record<string, MappingRule> = {};
  const edgeMapping: Record<string, MappingRule> = {};
  const idMap = new Map<string, string>();
  // NODE MAPPING
  for (const target_step of target.steps) nodeMapping[target_step.id] = null;
  for (const source_step of source.steps) {
    if (!source_step.id) continue; // yh. we'll always have it.
    let result: Workflow['steps'] = target.steps;

    // finding by id
    result = findById(source_step.id, result.length ? result : target.steps);
    if (result.length === 1) {
      nodeMapping[source_step.id] = getStepUuid(result[0]);
      idMap.set(source_step.id, result[0].id);
      continue;
    }

    // finding by parent
    const parent = getParent(source_step.id, source.steps);
    if (parent) {
      result = findByParent(parent, result.length ? result : target.steps);
      if (result.length === 1) {
        nodeMapping[source_step.id] = getStepUuid(result[0]);
        idMap.set(source_step.id, result[0].id);
        continue;
      }
    }

    // finding by children
    let tmp_final: Workflow['steps'][number];
    const children = getEdges(source.steps)[source_step.id];
    result = findByChildren(children, result.length ? result : target.steps);
    if (result.length === 1) {
      nodeMapping[source_step.id] = getStepUuid(result[0]);
      idMap.set(source_step.id, result[0].id);
      continue;
    } else if (result.length) {
      tmp_final = result[0];
    }

    // finding by expression | very flawed
    result = findByExpression(
      (source_step as Job).expression,
      result.length ? result : target.steps
    );
    if (result.length === 1) {
      nodeMapping[source_step.id] = getStepUuid(result[0]);
      idMap.set(source_step.id, result[0].id);
      continue;
    }

    // if find by expression did nothing but children did then use that.
    if (tmp_final) {
      nodeMapping[source_step.id] = getStepUuid(tmp_final);
      idMap.set(source_step.id, result[0].id);
    } else if (nodeMapping[source_step.id] === undefined)
      nodeMapping[source_step.id] = true;
  }

  // EDGE MAPPING
  // this needs to be a bit smart!!!
  // get edges
  const targetEdges = getEdges(target.steps);
  const sourceEdges = getEdges(source.steps);
  for (const [parent, children] of Object.entries(targetEdges)) {
    for (const child of children) {
      const edgeKey = `${parent}-${child}`;
      edgeMapping[edgeKey] = null;
    }
  }

  for (const [parent, children] of Object.entries(sourceEdges)) {
    for (const child of children) {
      const tparent = idMap.has(parent) ? idMap.get(parent) : parent;
      const tchild = idMap.has(child) ? idMap.get(child) : child;
      const edgeKey = `${parent}-${child}`;
      const targetEdgeKey = `${tparent}-${tchild}`;
      if (edgeMapping[targetEdgeKey] === null)
        edgeMapping[edgeKey] = getEdgeUuid(tparent, tchild, target.steps);
      else edgeMapping[edgeKey] = true;
    }
  }

  return {
    nodes: nodeMapping,
    edges: edgeMapping,
  };
};

function getEdgeUuid(
  parentId: string,
  childId: string,
  steps: Workflow['steps']
) {
  const parentNode = steps.find((step) => step.id === parentId);
  if (!parentNode) return;
  if (typeof parentNode.next !== 'object') return;
  const edge = parentNode.next[childId];
  return edge?.openfn?.uuid;
}
function getStepUuid(step: Workflow['steps'][number]) {
  return step?.openfn?.uuid || step.id;
}
function getEdges(steps: Workflow['steps']) {
  const edges: Record<string, string[]> = {};
  for (const step of steps) {
    const next =
      typeof step.next === 'string' ? { [step.next]: true } : step.next || {};

    for (const toNode of Object.keys(next)) {
      if (!Array.isArray(edges[step.id])) edges[step.id] = [toNode];
      else edges[step.id].push(toNode);
    }
  }
  return edges;
}

function getParent(id: string, steps: Workflow['steps']) {
  const edges = getEdges(steps);
  const found = Object.entries(edges).find(([parent, children]) =>
    children.includes(id)
  );
  if (!found) return;
  return found[0]; // getting the parent id
}

function findById(id: string, steps: Workflow['steps']) {
  return steps.filter((step: Job) => step.id === id);
}

// very flawed, due to the commented code snipped every step comes with.
function findByExpression(exp: string, steps: Workflow['steps']) {
  // find a node having the same expression
  return steps.filter(
    (step: Job) =>
      step.expression && !!step.expression.trim() && step.expression === exp
  );
}

function findByParent(parentId: string, steps: Workflow['steps']) {
  // returns all nodes having the parentId as parent
  const edges = getEdges(steps);
  const matched = edges[parentId];
  if (!matched || matched.length === 0) return [];
  return steps.filter((step) => matched.includes(step.id));
}

function findByChildren(childIds: string[], steps: Workflow['steps']) {
  // return best candidates for the child ids
  const edges = getEdges(steps);
  const countIndex: Record<string, number> = {};
  for (const [parent, children] of Object.entries(edges)) {
    let count = 0;
    for (const child of children) {
      if (childIds.includes(child)) count++;
    }
    if (count > 0) countIndex[parent] = count;
  }
  const parents = Object.entries(countIndex)
    .sort(([p1, c1], [p2, c2]) => c2 - c1)
    .map(([parent, count]) => parent);

  const stepsIndex = steps.reduce((a, b) => {
    a[b.id] = b;
    return a;
  }, {} as Record<string, Workflow['steps'][number]>);

  return parents.map((p) => stepsIndex[p]);
}

// Get an array of all UUIDS
const extractUUIDS = (p: Project) => {};
