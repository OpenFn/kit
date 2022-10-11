import { print } from 'recast';
import createLogger, { Logger } from '@openfn/logger';
import parse from './parse';
import transform, { TransformOptions } from './transform';
import { isPath, loadFile } from './util';

const defaultLogger = createLogger()

// TODO want to migrate to this but it'll break everything...
// type FutureOptions = {
//   logger?: Logger;
//   transform?: TransformOptions;
// }

export type Options = TransformOptions & {
  logger?: Logger
};

export default function compile(pathOrSource: string, options: Options = {}) {
  const logger = options.logger || defaultLogger;
  logger.debug('Starting compilation');

  let source = pathOrSource;
  if (isPath(pathOrSource)) {
    logger.debug('Compiling from file at', pathOrSource);
    source = loadFile(pathOrSource)
  } else {
    logger.debug('Compling from string');
  }
  const ast = parse(source);
  logger.debug('Parsed source tree')

  const transformedAst = transform(ast, undefined, options);
  logger.debug('Transformed source AST')

  const compiledSource = print(transformedAst).code;
  logger.debug('Compiled source:')
  logger.debug(compiledSource); // TODO indent or something

  return compiledSource;
}