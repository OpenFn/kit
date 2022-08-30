/**
 * Transform an AST into a job compatible with the open fn run time
 * - Move leading top level code into a fn() job
 * - Move top-level code
 * - Ignore any other top-level code
 * 
 * 
 * Instead of calling visit() many times, what if we traverse the tree once
 * and call all of our transformers on it?
 * Well, that makes ordering a bit harder
 */
import { namedTypes, NodePath } from 'ast-types';
import { visit } from 'recast';

import { ensureExports } from './transforms';

type VisitorFunction =  (path: typeof NodePath) => boolean | undefined; // return true to abort further traversal

type Visitor = {
  types: string[];
  visitor: VisitorFunction;
}

type VisitorMap = Record<string, VisitorFunction[]>;

export default function transform(ast: namedTypes.Node, visitorList?: Visitor[]) {
  if (!visitorList) {
    // TODO maybe automate this from imports
    visitorList = [ensureExports];
  }
  const visitors = buildvisitorMap(visitorList);
  visit(ast, buildVisitorFunction(visitors))

  return ast;
}

export function buildvisitorMap(visitors: Visitor[]): VisitorMap {
  const map: Record<string, VisitorFunction[]> = {};
  for (const { types, visitor } of visitors) {
    for (const type of types) {
      const name = `visit${type}`;
      if (!map[name]) {
        map[name] = [];
      }
      map[name].push(visitor);
    }
  }
  return map;
}

function buildVisitorFunction(visitors: VisitorMap) {
  const result: Record<string, VisitorFunction> = {};

  for (const v in visitors) {
    result[v] = function(path: typeof NodePath) {
      const fns = visitors[v];
      for(const next of fns) {
        const abort = next!(path);
        if (abort) {
          return false;
        }
      }
      this.traverse(path);
    }
  }
  return result;
}