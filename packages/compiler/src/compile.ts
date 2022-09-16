import { print } from 'recast';
import parse from './parse';
import transform, { TransformOptions } from './transform';
import { isPath, loadFile } from './util';

export default function compile(pathOrSource: string, options: TransformOptions = {}) {
  const source = isPath(pathOrSource) ? loadFile(pathOrSource) : pathOrSource;
  const ast = parse(source);
  const transformedAst = transform(ast, undefined, options);
  const compiledSource = print(transformedAst).code;

  return compiledSource;
}