import { print } from 'recast';
import createLogger, { Logger } from '@openfn/logger';
import parse from './parse';
import transform, { TransformOptions } from './transform';
import { isPath, loadFile } from './util';

const defaultLogger = createLogger('Compiler')

// TODO want to migrate to this but it'll break everything...
type FutureOptions = {
  logger?: Logger;
  transform?: TransformOptions;
}

type Options = TransformOptions & {
  logger: Logger
};

export default function compile(pathOrSource: string, options: Options = {}) {
  // TODO need a few unit tests around the logger
  // also I'm not enjoying how it's fed through to the transformers
  const logger = options.logger || defaultLogger;
  const source = isPath(pathOrSource) ? loadFile(pathOrSource) : pathOrSource;
  const ast = parse(source);
  const transformedAst = transform(ast, undefined, options);
  const compiledSource = print(transformedAst).code;

  return compiledSource;
}