import { namedTypes, Visitor } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import { visit } from 'recast';
import createLogger, { Logger } from '@openfn/logger';

import addImports, { AddImportsOptions } from './transforms/add-imports';
import ensureExports from './transforms/ensure-exports';
import topLevelOps, {
  TopLevelOpsOptions,
} from './transforms/top-level-operations';

export type TransformerName =
  | 'add-imports'
  | 'ensure-exports'
  | 'top-level-operations'
  | 'test';

type TransformFunction = (
  path: NodePath<any, any>,
  logger: Logger,
  options?: any | boolean
) => Promise<boolean | undefined> | boolean | undefined | void; // return true to abort further traversal

export type Transformer = {
  id: TransformerName;
  types: string[];
  visitor: TransformFunction;
};

type TransformerIndex = Partial<Record<keyof Visitor, Transformer[]>>;

export type TransformOptions = {
  logger?: Logger; //  TODO maybe in the wrong place?

  ['add-imports']?: AddImportsOptions | boolean;
  ['ensure-exports']?: boolean;
  ['top-level-operations']?: TopLevelOpsOptions | boolean;
  ['test']?: any;
};

const defaultLogger = createLogger();

export default function transform(
  ast: namedTypes.Node,
  transformers?: Transformer[],
  options: TransformOptions = {}
) {
  if (!transformers) {
    transformers = [ensureExports, topLevelOps, addImports] as Transformer[];
  }
  const logger = options.logger || defaultLogger;
  const transformerIndex = indexTransformers(transformers, options);

  const v = buildVisitors(transformerIndex, logger, options);
  // @ts-ignore generic disagree on Visitor, so disabling type checking for now
  visit(ast, v);

  return ast;
}

// Build a map of AST node types against an array of transform functions
export function indexTransformers(
  transformers: Transformer[],
  options: TransformOptions = {}
): TransformerIndex {
  const index: TransformerIndex = {};
  for (const t of transformers) {
    const { types, id } = t;
    if (options[id] !== false) {
      for (const type of types) {
        const name = `visit${type}` as keyof Visitor;
        if (!index[name]) {
          index[name] = [];
        }
        index[name]!.push(t);
      }
    }
  }
  return index;
}

// Build an index of AST visitors, where each node type is mapped to a visitor function which
// calls out to the correct transformer, passing a logger and options
export function buildVisitors(
  transformerIndex: TransformerIndex,
  logger: Logger,
  options: TransformOptions = {}
) {
  const visitors: Visitor = {};

  for (const k in transformerIndex) {
    const astType = k as keyof Visitor;
    visitors[astType] = function (path: NodePath) {
      const transformers = transformerIndex[astType]!;
      for (const { id, visitor } of transformers) {
        const opts = options[id] || {};
        const abort = visitor!(path, logger, opts);
        if (abort) {
          return false;
        }
      }
      this.traverse(path);
    };
  }
  return visitors;
}
