import { namedTypes, Visitor } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import { visit } from 'recast';
import createLogger, { Logger } from '@openfn/logger';

import addImports, { AddImportsOptions } from './transforms/add-imports';
import ensureExports from './transforms/ensure-exports';
import lazyState from './transforms/lazy-state';
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
};

type TransformerIndex = Partial<Record<keyof Visitor, Transformer[]>>;

export type TransformOptions = {
  logger?: Logger; //  TODO maybe in the wrong place?

  ['add-imports']?: AddImportsOptions | boolean;
  ['ensure-exports']?: boolean;
  ['top-level-operations']?: TopLevelOpsOptions | boolean;
  ['test']?: any;
  ['lazy-state']?: any;
};

const defaultLogger = createLogger();

export default function transform(
  ast: namedTypes.Node,
  transformers?: Transformer[],
  options: TransformOptions = {}
) {
  if (!transformers) {
    transformers = [
      lazyState,
      ensureExports,
      topLevelOps,
      addImports,
    ] as Transformer[];
  }
  const logger = options.logger || defaultLogger;

  // TODO sort transformers by order

  transformers.forEach(({ id, types, visitor }) => {
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
