import { print } from 'recast';
import createLogger, { Logger } from '@openfn/logger';

import parse from './parse';
import transform, { TransformOptions } from './transform';
import { isPath, loadFile } from './util';

import type { SourceMapWithOperations } from '@openfn/lexicon';

const defaultLogger = createLogger();

// TODO want to migrate to this but it'll break everything...
// type FutureOptions = {
//   logger?: Logger;
//   transform?: TransformOptions;
// }

export type Options = TransformOptions & {
  name?: string;
  logger?: Logger;
  logCompiledSource?: boolean;
};

export default function compile(
  pathOrSource: string,
  options: Options = {}
): {
  code: string;
  map?: SourceMapWithOperations;
} {
  const logger = options.logger || defaultLogger;

  let source = pathOrSource;
  if (isPath(pathOrSource)) {
    //logger.debug('Starting compilation from file at', pathOrSource);
    source = loadFile(pathOrSource);
  } else {
    //logger.debug('Starting compilation from string');
  }

  const name = options.name ?? 'src';
  const ast = parse(source, { name });
  const transformedAst = transform(ast, undefined, options);

  const { code, map } = print(transformedAst, {
    sourceMapName: `${name}.map.js`,
  });

  // write the operations index to the source map
  map.operations = (transformedAst.program as any).operations ?? [];

  if (options.logCompiledSource) {
    logger.debug('Compiled source:');
    logger.debug(code);
  }

  return { code, map };
}
