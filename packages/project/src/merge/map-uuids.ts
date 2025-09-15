
import { Job } from '@openfn/lexicon';
import { Project } from '../Project';
import Workflow from '../Workflow';

export interface MappingResults {
  nodes: Record<string, string>;  // source node id -> target nodes uuid
  edges: Record<string, string>;  // source edge key -> target edge uuid
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
 * 
 * The algorithm uses a multi-stage approach:
 * 1. Direct ID matching
 * 2. Root node mapping
 * 3. Structural matching (parent/children relationships) & expression matching
 * 4. Edge mapping
 */

export default (source: Workflow, target: Workflow): MappingResults => {
  const targetEdges = target.getAllEdges();
  const sourceEdges = source.getAllEdges();

  // 1: direct id matching
  const initialMapping = mapStepsById(source.steps, target.steps);
  let nodeMapping = initialMapping.mapping;
  let unmappedSource = initialMapping.pool.source;
  let unmappedTarget = initialMapping.pool.target;
  let idMap = initialMapping.idMap;

  // 2: root node mapping
  // we always map root nodes without any special logic
  mapRootNodes(source, target, idMap, nodeMapping);

  // Helper function to get mapped ID or fallback to original
  const getMappedId = (id: string) => idMap.get(id) || id;

  // 3: structural & expression matching
  const tries = 6; // I think 6 should be a good number of iterations
  for (let i = 0; i < tries; i++) {
    const remainingUnmapped = findRemainingUnmappedNodes(unmappedSource, idMap);
    
    for (const sourceStep of remainingUnmapped) {
      const candidates = getUnmappedCandidates(unmappedTarget, idMap);
      
      const mappingResult = findBestMatch(
        sourceStep,
        candidates,
        sourceEdges,
        targetEdges,
        getMappedId,
        i === tries - 1 // isLastIteration
      );

      if (mappingResult) {
        nodeMapping[sourceStep.id] = getStepUuid(mappingResult);
        idMap.set(sourceStep.id, mappingResult.id);
      }
    }
  }

  // 4: edge mapping
  const edgeMapping = mapEdges(sourceEdges, targetEdges, idMap, target.steps);

  return {
    nodes: nodeMapping,
    edges: edgeMapping,
  };
}

// HELPER FUNCTIONS

// maps root nodes between source and target workflows
function mapRootNodes(
  source: Workflow, 
  target: Workflow, 
  idMap: Map<string, string>, 
  nodeMapping: Record<string, string>
): void {
  const sourceRoot = source.getRoot();
  const targetRoot = target.getRoot();
  
  if (sourceRoot && targetRoot) {
    idMap.set(sourceRoot.id, targetRoot.id);
    nodeMapping[sourceRoot.id] = getStepUuid(targetRoot);
  }
}

// finds nodes that haven't been mapped yet
function findRemainingUnmappedNodes(
  unmappedSource: Workflow['steps'], 
  idMap: Map<string, string>
): Workflow['steps'] {
  return unmappedSource.filter(step => 
    step.id && !idMap.has(step.id)
  );
}

// gets candidate nodes that haven't been mapped yet
function getUnmappedCandidates(
  unmappedTarget: Workflow['steps'], 
  idMap: Map<string, string>
): Workflow['steps'] {
  const mappedIds = new Set(idMap.values());
  return unmappedTarget.filter(step => !mappedIds.has(step.id));
}

// finds the best match for a source step using multiple strategies
function findBestMatch(
  sourceStep: Workflow['steps'][number],
  candidates: Workflow['steps'],
  sourceEdges: EdgesType,
  targetEdges: EdgesType,
  getMappedId: (id: string) => string,
  isLastIteration: boolean
): Workflow['steps'][number] | null {
  if (candidates.length === 0) return null;

  let bestCandidates = candidates;
  let topResult: Workflow['steps'][number] | null = null;
  let didStructuralFilter = false;

  // 1: match by parent relationship
  const parentResult = mapStepByParent(
    sourceStep, bestCandidates, sourceEdges, targetEdges, getMappedId
  );
  if (parentResult.candidates.length > 0) {
    bestCandidates = parentResult.candidates;
    topResult = bestCandidates[0];
    didStructuralFilter ||= parentResult.filtered;
  }
  
  if (bestCandidates.length === 1) {
    return bestCandidates[0];
  }

  // 2: match by children relationship
  const childrenResult = mapStepByChildren(
    sourceStep, bestCandidates, sourceEdges, targetEdges, getMappedId
  );
  if (childrenResult.candidates.length > 0) {
    bestCandidates = childrenResult.candidates;
    topResult = bestCandidates[0];
    didStructuralFilter ||= childrenResult.filtered;
  }
  
  if (bestCandidates.length === 1) {
    return bestCandidates[0];
  }

  // 3: match by expression content
  const expressionCandidates = mapStepByExpression(sourceStep, bestCandidates);
  if (expressionCandidates.length > 0) {
    bestCandidates = expressionCandidates;
  }
  
  if (bestCandidates.length === 1) {
    return bestCandidates[0];
  }

  // 4: fallback to structural match if available and candidate still not resolved
  if (isLastIteration && didStructuralFilter && topResult) {
    return topResult;
  }

  return null;
}

// maps edges between source and target workflows
function mapEdges(
  sourceEdges: EdgesType,
  targetEdges: EdgesType,
  idMap: Map<string, string>,
  targetSteps: Workflow['steps']
): Record<string, string> {
  const edgeMapping: Record<string, string> = {};
  
  for (const [parentId, children] of Object.entries(sourceEdges)) {
    for (const childId of children) {
      const sourceEdgeKey = `${parentId}-${childId}`;
      
      // use already mapped ids or use the original
      const mappedParentId = idMap.get(parentId) || parentId;
      const mappedChildId = idMap.get(childId) || childId;
      
      // find the expected edge in target
      const targetEdgeId = getEdgeUuid(mappedParentId, mappedChildId, targetSteps);
      if (targetEdgeId) {
        edgeMapping[sourceEdgeKey] = targetEdgeId;
      }
    }
  }
  
  return edgeMapping;
}

// gets UUID for an edge
function getEdgeUuid(
  parentId: string,
  childId: string,
  steps: Workflow['steps']
): string | undefined {
  const parentNode = steps.find(step => step.id === parentId);
  if (!parentNode || typeof parentNode.next !== 'object') return undefined;
  
  const edge = parentNode.next[childId];
  return edge?.openfn?.uuid;
}

// gets UUID for a step
function getStepUuid(step: Workflow['steps'][number]): string {
  return step?.openfn?.uuid || step.id;
}

// MAPPING FUNCTIONS
interface Pool {
  source: Workflow['steps'];
  target: Workflow['steps'];
}

interface MapStepsByIdResult {
  mapping: Record<string, string>;
  idMap: Map<string, string>;
  pool: Pool;
}

 // does 1-1 mapping of nodes by their ids
function mapStepsById(
  source: Workflow['steps'],
  target: Workflow['steps']
): MapStepsByIdResult {
  const targetIndex: Record<string, Workflow['steps'][number]> = {};
  const mapping: Record<string, string> = {};
  const idMap = new Map<string, string>();

  for (const targetStep of target) {
    targetIndex[targetStep.id] = targetStep;
  }

  const unmappedSourceIndices: number[] = [];
  const unmappedTarget = [...target];

  for (let i = 0; i < source.length; i++) {
    const sourceStep = source[i];
    const matchingTarget = targetIndex[sourceStep.id];
    
    if (matchingTarget) {
      // direct match found
      mapping[sourceStep.id] = getStepUuid(matchingTarget);
      idMap.set(sourceStep.id, matchingTarget.id);
      
      // remove from unmapped target list
      const targetIndex = unmappedTarget.findIndex(t => t.id === matchingTarget.id);
      if (targetIndex !== -1) {
        unmappedTarget.splice(targetIndex, 1);
      }
    } else {
      unmappedSourceIndices.push(i);
    }
  }

  return {
    mapping,
    idMap,
    pool: {
      source: source.filter((_, i) => unmappedSourceIndices.includes(i)),
      target: unmappedTarget,
    },
  };
}

// gets parent nodes of a given node id
function getParent(id: string, edges: EdgesType): string[] {
  return Object.entries(edges)
    .filter(([, children]) => children.includes(id))
    .map(([parentId]) => parentId);
}

// SEARCH FUNCTIONS

// finds steps with matching expression content
function findByExpression(expression: string, steps: Workflow['steps']): Workflow['steps'] {
  return steps.filter((step: Job) => 
    step.expression && 
    step.expression.trim() && 
    step.expression === expression
  );
}

// finds steps that have specific parent nodes
function findByParent(
  parentIds: string[],
  edges: EdgesType,
  steps: Workflow['steps']
): Workflow['steps'] {
  const matches: Workflow['steps'] = [];
  
  for (const parentId of parentIds) {
    const children = edges[parentId];
    if (!children || children.length === 0) continue;
    
    const matchingSteps = steps.filter(step => children.includes(step.id));
    matches.push(...matchingSteps);
  }
  
  return matches;
}


// finds steps whose children best match the given child ids
// returns steps sorted by the number of matching children (highest first)
function findByChildren(
  childIds: string[],
  edges: EdgesType,
  steps: Workflow['steps']
): Workflow['steps'] {
  // holds how many children each candidate matches
  const childMatchCount: Record<string, number> = {};
  
  for (const [parentId, children] of Object.entries(edges)) {
    const matchCount = children.filter(childId => childIds.includes(childId)).length;
    if (matchCount > 0) {
      childMatchCount[parentId] = matchCount;
    }
  }

  // sort node by match count (highest first)
  const sortedParentIds = Object.entries(childMatchCount)
    .sort(([, count1], [, count2]) => count2 - count1)
    .map(([parentId]) => parentId);

  const stepIndex = steps.reduce((index, step) => {
    index[step.id] = step;
    return index;
  }, {} as Record<string, Workflow['steps'][number]>);

  // returns matched steps in order of best match
  return sortedParentIds
    .filter(parentId => stepIndex[parentId])
    .map(parentId => stepIndex[parentId]);
}

// MAPPING STRATEGY FUNCTIONS

 // maps steps by parent relationship
function mapStepByParent(
  sourceStep: Workflow['steps'][number],
  candidates: Workflow['steps'],
  sourceEdges: EdgesType,
  targetEdges: EdgesType,
  getMappedId: (id: string) => string
): MapStepResult {
  const sourceParents = getParent(sourceStep.id, sourceEdges);
  
  if (sourceParents.length === 0) {
    return { filtered: false, candidates };
  }

  const mappedParentIds = sourceParents.map(getMappedId);
  const matchingCandidates = findByParent(mappedParentIds, targetEdges, candidates);
  
  return {
    filtered: true,
    candidates: matchingCandidates,
  };
}


// maps steps by children relationship
function mapStepByChildren(
  sourceStep: Workflow['steps'][number],
  candidates: Workflow['steps'],
  sourceEdges: EdgesType,
  targetEdges: EdgesType,
  getMappedId: (id: string) => string
): MapStepResult {
  const sourceChildren = sourceEdges[sourceStep.id];
  
  if (!sourceChildren) {
    return { filtered: false, candidates }; // Leaf node - can't map by children
  }

  const mappedChildIds = sourceChildren.map(getMappedId);
  const matchingCandidates = findByChildren(mappedChildIds, targetEdges, candidates);
  
  return {
    filtered: true,
    candidates: matchingCandidates,
  };
}

// maps steps by expression content
function mapStepByExpression(
  sourceStep: Workflow['steps'][number],
  candidates: Workflow['steps']
): Workflow['steps'] {
  const expression = (sourceStep as Job).expression;
  return findByExpression(expression, candidates);
}
