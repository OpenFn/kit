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
import { namedTypes } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import { visit } from 'recast';
import createLogger, { Logger } from '@openfn/logger';

import addImports, { AddImportsOptions } from './transforms/add-imports';
import ensureExports from './transforms/ensure-exports';
import topLevelOps, { TopLevelOpsOptions } from './transforms/top-level-operations';

export type TransformerName = 'add-imports' | 'ensure-exports' | 'top-level-operations' | 'test';

type VisitorFunction =  (path: NodePath<any,any>, options?: any | boolean) => Promise<boolean | undefined> | boolean | undefined | void; // return true to abort further traversal

export type Visitor = {
  id: TransformerName;  // TODO would rather not include this but I can't see a better solution right now...
  types: string[];
  visitor: VisitorFunction;
}

type VisitorMap = Record<string, VisitorFunction[]>;

export type TransformOptions = {
  logger?: Logger; //  TODO maybe in the wrong place?

  // TODO is there a neat way to automate this?
  ['add-imports']?: AddImportsOptions | boolean;
  ['ensure-exports']?: boolean;
  ['top-level-operations']?: TopLevelOpsOptions | boolean;
  ['test']?: any;
}

const defaultLogger = createLogger();

export default function transform(
  ast: namedTypes.Node,
  visitorList?: Visitor[],
  options: TransformOptions = {},
  ) {
  if (!visitorList) {
    // TODO maybe automate this from imports?
    visitorList = [ensureExports, topLevelOps, addImports];
  }
  const visitors = buildvisitorMap(visitorList as Visitor[], options);
  visit(ast, buildVisitorMethods(visitors))

  return ast;
}

// Build a map of AST node types against an array of visitor functions
// Each visitor must trap the appropriate options
export function buildvisitorMap(visitors: Visitor[], options: TransformOptions = {}): VisitorMap {
  const logger = options.logger || defaultLogger;
  const map: Record<string, VisitorFunction[]> = {};
  for (const { types, visitor, id } of visitors) {
    if (options[id] !== false) {
      for (const type of types) {
        const name = `visit${type}`;
        if (!map[name]) {
          map[name] = [];
        }
        map[name].push((n: NodePath) => visitor(n, options[id] ?? {}, logger));
      }
    }
  }
  return map;
}

export function buildVisitorMethods(visitors: VisitorMap) {
  const result: Record<string, VisitorFunction> = {};

  for (const v in visitors) {
    result[v] = function(path: NodePath) {
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