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

export interface MappingResults {
  nodes: Record<string, string>;
  edges: Record<string, string>;
}

type EdgesType = Record<string, string[]>;
type MapStepResult = {
  filtered: boolean;
  candidates: Workflow['steps'][number];
};

/**
 * Compare two Workflows and identify matching nodes across them.
 *
 * This is designed to help merging two workflows together, ensuring that
 * as many UUIDs are preserved in the target workflow as possible.
 *
 * Returns node and edge maps, where the key is the id in the source, and the
 * value is the corresponding UUID in the target,
 * ie: `{
 *  // source id: target UUID
 *  a: '851341-1234124-1512'
 * }
 */
export default (source: Workflow, target: Workflow): MappingResults => {
  // generate edges for source & target workflow
  const targetEdges = target.getAllEdges();
  const sourceEdges = source.getAllEdges();

  // First, simply map nodes with the same id
  let {
    mapping: nodeMapping,
    pool,
    idMap,
  } = mapStepsById(source.steps, target.steps);

  // Second, map the root nodes
  const sourceRoot = source.getRoot();
  const targetRoot = target.getRoot();
  if (sourceRoot && targetRoot) {
    idMap.set(sourceRoot.id, targetRoot.id);
    nodeMapping[sourceRoot.id] = getStepUuid(targetRoot);
  }

  const getMappedId = (id: string) => {
    if (idMap.has(id)) return idMap.get(id) as string;
    return id;
  };

  // Now, for any nodes that weren't mapped, try and find a suitable mapping
  let tries = 2;
  while (tries--) {
    for (const source_step of pool.source) {
      if (!source_step.id || idMap.has(source_step.id)) continue; // yh. we'll always have it.

      // these are the candidates for the search. removes already mapped candidates
      const mappedCandidates = [...idMap.values()];
      let candidates = pool.target.filter(
        (step) => !mappedCandidates.includes(step.id)
      );

      let top_result; // holds the top result after a structural filter
      let did_filter = false; // holds whether a structural filter was successful

      // Is there an unmapped node with the same parent?
      let result = mapStepByParent(
        source_step,
        candidates,
        sourceEdges,
        targetEdges,
        getMappedId
      );
      if (result.candidates.length) {
        candidates = result.candidates;
        top_result = candidates[0];
        did_filter ||= result.filtered;
      }
      if (candidates.length === 1) {
        nodeMapping[source_step.id] = getStepUuid(candidates[0]);
        idMap.set(source_step.id, candidates[0].id);
        continue;
      }

      // Is there an unmapped node with the same children?
      result = mapStepByChildren(
        source_step,
        candidates,
        sourceEdges,
        targetEdges,
        getMappedId
      );
      if (result.candidates.length) {
        top_result = candidates[0];
        candidates = result.candidates;
        did_filter ||= result.filtered;
      }
      if (candidates.length === 1) {
        nodeMapping[source_step.id] = getStepUuid(candidates[0]);
        idMap.set(source_step.id, candidates[0].id);
        continue;
      }

      // Is there an unmapped node with the same expression?
      result = mapStepByExpression(source_step, candidates);
      if (result.length) candidates = result;
      if (candidates.length === 1) {
        nodeMapping[source_step.id] = getStepUuid(candidates[0]);
        idMap.set(source_step.id, candidates[0].id);
        continue;
      } else if (
        did_filter &&
        candidates.length > 1 &&
        top_result &&
        tries < 1
      ) {
        // if we were unable to match by expression but at least one structural filter passed. pick the top_result
        nodeMapping[source_step.id] = getStepUuid(top_result);
        idMap.set(source_step.id, top_result.id);
      }
    }
  }

  // Edge mapping
  const edgeMapping: MappingResults['edges'] = {};
  for (const [parent, children] of Object.entries(sourceEdges)) {
    for (const child of children) {
      // the edge in the source we want to map <parent> - <child>
      const edgeKey = `${parent}-${child}`;
      // if <parent> was mapped, use that instead
      const tparent = idMap.has(parent) ? idMap.get(parent) : parent;
      // if <child> was mapped, use that instead
      const tchild = idMap.has(child) ? idMap.get(child) : child;
      // the expected edge in the target
      const targetEdgeKey = `${tparent}-${tchild}`;
      // if it's not already mapped, then map it
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

// util for getting uuid from and edge
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

// util for getting uuid from a step
function getStepUuid(step: Workflow['steps'][number]) {
  return step?.openfn?.uuid || step.id;
}

// return the parents of a node
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

interface MapStepsByIdResult {
  mapping: Record<string, string>;
  idMap: Map<string, string>;
  pool: Pool;
}

// does a 1-1 mapping of nodes by their id
function mapStepsById(
  source: Workflow['steps'],
  target: Workflow['steps']
): MapStepsByIdResult {
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

// returns which of the candidate nodes have the same parent as source_step
function mapStepByParent(
  source_step: Workflow['steps'][number],
  candidates: Workflow['steps'],
  sourceEdges: EdgesType,
  targetEdges: EdgesType,
  getMappedId: (id: string) => string
): MapStepResult {
  const parents = getParent(source_step.id, sourceEdges);
  if (!parents.length) {
    return { filtered: false, candidates };
  }
  return {
    filtered: true,
    candidates: findByParent(parents.map(getMappedId), targetEdges, candidates),
  };
}

// returns which of the candidate nodes have the same children as source_step to a higher degree
function mapStepByChildren(
  source_step: Workflow['steps'][number],
  candidates: Workflow['steps'],
  sourceEdges: EdgesType,
  targetEdges: EdgesType,
  getMappedId: (id: string) => string
): MapStepResult {
  const children = sourceEdges[source_step.id];
  if (!children) return { filtered: false, candidates }; // this means they can't be mapped by children - because it's a leaf node
  return {
    filtered: true,
    candidates: findByChildren(
      children.map(getMappedId),
      targetEdges,
      candidates
    ),
  };
}

// return which of the candidate nodes have the same expression as source_step
function mapStepByExpression(
  source_step: Workflow['steps'][number],
  candidates: Workflow['steps']
) {
  return findByExpression((source_step as Job).expression, candidates);
}
