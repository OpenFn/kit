import { namedTypes, Visitor } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import { visit } from 'recast';
import createLogger, { Logger } from '@openfn/logger';

import addImports, { AddImportsOptions } from './transforms/add-imports';
import ensureExports from './transforms/ensure-exports';
import lazyState from './transforms/lazy-state';
import promises from './transforms/promises';
import topLevelOps, {
  TopLevelOpsOptions,
} from './transforms/top-level-operations';

export type TransformerName =
  | 'add-imports'
  | 'ensure-exports'
  | 'top-level-operations'
  | 'test'
  | 'lazy-state';

type TransformFunction = (
  path: NodePath<any, any>,
  logger: Logger,
  options?: any | boolean
) => Promise<boolean | undefined> | boolean | undefined | void; // return true to abort further traversal

export type Transformer = {
  id: TransformerName;
  types: string[];
  visitor: TransformFunction;
  order?: number;
};

export type TransformOptions = {
  logger?: Logger; //  TODO maybe in the wrong place?

  ['add-imports']?: AddImportsOptions | boolean;
  ['ensure-exports']?: boolean;
  ['top-level-operations']?: TopLevelOpsOptions | boolean;
  ['test']?: any;
  ['lazy-state']?: any;
  ['promises']?: any;
};

const defaultLogger = createLogger();

export default function transform(
  ast: namedTypes.File,
  transformers?: Transformer[],
  options: TransformOptions = {}
) {
  if (!transformers) {
    transformers = [
      lazyState,
      promises,
      ensureExports,
      topLevelOps,
      addImports,
    ] as Transformer[];
  }
  const logger = options.logger || defaultLogger;

  transformers
    // Ignore transformers which are explicitly disabled
    .filter(({ id }) => options[id] ?? true)
    // Set default orders
    .map((t) => ({ ...t, order: t.order ?? 1 }))
    // Sort by order
    .sort((a, b) => {
      if (a.order > b.order) return 1;
      if (a.order < b.order) return -1;
      return 0;
    })
    // Run each transformer
    .forEach(({ id, types, visitor }) => {
      const astTypes: Visitor = {};
      for (const type of types) {
        const name = `visit${type}` as keyof Visitor;
        astTypes[name] = function (path: NodePath) {
          const opts = options[id] || {};
          const abort = visitor!(path, logger, opts);
          if (abort) {
            return false;
          }
          this.traverse(path);
        };
      }

      // @ts-ignore
      visit(ast, astTypes);
    });

  return ast;
}
