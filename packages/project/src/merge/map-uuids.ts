/**
 * Identify identical nodes in two projects
 *
 * this function will take two workflows
 * and it'll return a map of step and edge UUIDs in A
 * and how they map to B
 *
 * If step names stay the same, this is trivial
 */

import { Job } from '@openfn/lexicon';
import { Project } from '../Project';
import Workflow from '../Workflow';

// changing parent and changing id is probably a new node
// changing id but preserving parent should map
// adding a new node an changing the id... an we track this?

// null: this item does not exist in B
// string: this item maps to this ID in B (could be the same)
// true: this item needs a new UUID in B

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
  nodes: Record<string, string>;
  edges: Record<string, string>;
}

type EdgesType = Record<string, string[]>;

export default (source: Workflow, target: Workflow): MappingResults => {
  const edgeMapping: MappingResults['edges'] = {};

  const targetEdges = getEdges(target.steps);
  const sourceEdges = getEdges(source.steps);

  // Map by id
  let {
    mapping: nodeMapping,
    pool,
    idMap,
  } = mapStepsById(source.steps, target.steps);

  const getMappedId = (id: string) => {
    if (idMap.has(id)) return idMap.get(id) as string;
    return id;
  };

  for (const source_step of pool.source) {
    if (!source_step.id) continue; // yh. we'll always have it.

    // these are the candidates for the search
    const mappedCandidates = [...idMap.values()]; // already mapped candidates
    let candidates = pool.target.filter(
      (step) => !mappedCandidates.includes(step.id)
    );

    let top_result;
    // Parent
    let result = mapStepByParent(
      source_step,
      candidates,
      sourceEdges,
      targetEdges,
      getMappedId
    );
    if (result.length) {
      candidates = result;
      top_result = candidates[0];
    }
    if (candidates.length === 1) {
      nodeMapping[source_step.id] = getStepUuid(candidates[0]);
      idMap.set(source_step.id, candidates[0].id);
      continue;
    }

    // Children
    result = mapStepByChildren(
      source_step,
      candidates,
      sourceEdges,
      targetEdges,
      getMappedId
    );
    if (result.length) {
      top_result = candidates[0];
      candidates = result;
    }
    if (candidates.length === 1) {
      nodeMapping[source_step.id] = getStepUuid(candidates[0]);
      idMap.set(source_step.id, candidates[0].id);
      continue;
    }

    // Expression
    result = mapStepByExpression(source_step, candidates);
    if (result.length) candidates = result;
    if (candidates.length === 1) {
      nodeMapping[source_step.id] = getStepUuid(candidates[0]);
      idMap.set(source_step.id, candidates[0].id);
      continue;
    } else if (candidates.length > 1 && top_result) {
      nodeMapping[source_step.id] = getStepUuid(top_result);
      idMap.set(source_step.id, top_result.id);
      continue;
    }
  }

  // EDGE MAPPING
  // this needs to be a bit smart!!!
  // get edges
  for (const [parent, children] of Object.entries(targetEdges)) {
    for (const child of children) {
      const edgeKey = `${parent}-${child}`;
    }
  }

  for (const [parent, children] of Object.entries(sourceEdges)) {
    for (const child of children) {
      const tparent = idMap.has(parent) ? idMap.get(parent) : parent;
      const tchild = idMap.has(child) ? idMap.get(child) : child;
      const edgeKey = `${parent}-${child}`;
      const targetEdgeKey = `${tparent}-${tchild}`;
      if (!edgeMapping[targetEdgeKey]) {
        const targetEdgeId = getEdgeUuid(tparent, tchild, target.steps);
        if (targetEdgeId) {
          // eg. if it's a new edge then the targetEdgeId would be undefined
          edgeMapping[edgeKey] = targetEdgeId;
        }
      }
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

function getParent(id: string, edges: EdgesType) {
  const parents = Object.entries(edges)
    .filter(([parent, children]) => children.includes(id))
    .map((p) => p[0]); // getting the parent id at [parent, children]
  return parents;
}

interface Pool {
  source: Workflow['steps'];
  target: Workflow['steps'];
}

interface MapStepResult {
  mapping: Record<string, string>;
  idMap: Map<string, string>;
  pool: Pool;
}

function mapStepsById(
  source: Workflow['steps'],
  target: Workflow['steps']
): MapStepResult {
  const targets: Record<string, Workflow['steps'][number]> = {};
  const mapping: MappingResults['nodes'] = {};
  const idMap = new Map<string, string>();

  for (const target_step of target) {
    targets[target_step.id] = target_step;
  }

  const removedIndexes = [];
  for (let i = 0; i < source.length; i++) {
    const source_step = source[i];
    if (targets[source_step.id]) {
      mapping[source_step.id] = targets[source_step.id]?.openfn?.uuid;
      idMap.set(source_step.id, targets[source_step.id]?.id);
      removedIndexes.push(i);
      target = target.filter((t) => t !== target[source_step]);
    }
  }

  return {
    mapping,
    idMap,
    pool: {
      source: source.filter((_, i) => !removedIndexes.includes(i)),
      target,
    },
  };
}

// findByExpression
// given an expression and a list of steps, return all steps that have this expression
function findByExpression(exp: string, steps: Workflow['steps']) {
  return steps.filter(
    (step: Job) =>
      step.expression && !!step.expression.trim() && step.expression === exp
  );
}

// findByParent
// given a parent node ID and a list of steps, return all steps that have this parent node ID as their parent
function findByParent(
  parentIds: string,
  edges: EdgesType,
  steps: Workflow['steps']
) {
  const matches: Workflow['steps'] = [];
  for (const parentId of parentIds) {
    const matched = edges[parentId];
    if (!matched || matched.length === 0) continue;
    matches.push(...steps.filter((step) => matched.includes(step.id)));
  }
  return matches;
}

// findByChildren
// given a list of IDs and a list of steps, return all steps where their children match the list of IDs from a higher degree
function findByChildren(
  childIds: string[],
  edges: EdgesType,
  steps: Workflow['steps']
) {
  // return best candidates for the child ids
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

  return parents.filter((p) => !!stepsIndex[p]).map((p) => stepsIndex[p]);
}

function mapStepByParent(
  source_step: Workflow['steps'][number],
  candidates: Workflow['steps'],
  sourceEdges: EdgesType,
  targetEdges: EdgesType,
  getMappedId: (id: string) => string
) {
  const parents = getParent(source_step.id, sourceEdges);
  if (!parents.length) return candidates;
  return findByParent(parents.map(getMappedId), targetEdges, candidates);
}

function mapStepByChildren(
  source_step: Workflow['steps'][number],
  candidates: Workflow['steps'],
  sourceEdges: EdgesType,
  targetEdges: EdgesType,
  getMappedId: (id: string) => string
) {
  const children = sourceEdges[source_step.id];
  if (!children) return candidates; // this means they can't be mapped by children - because it's a leaf node
  return findByChildren(children.map(getMappedId), targetEdges, candidates);
}

function mapStepByExpression(
  source_step: Workflow['steps'][number],
  candidates: Workflow['steps']
) {
  return findByExpression((source_step as Job).expression, candidates);
}

// Get an array of all UUIDS
const extractUUIDS = (p: Project) => {};
