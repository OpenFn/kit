import { print } from 'recast';
import parse from './parse';
import transform from './transform';
import { isPath, loadFile } from './util';

export default function compile(pathOrSource: string) {
  const source = isPath(pathOrSource) ? loadFile(pathOrSource) : pathOrSource;

  const ast = parse(source);
  const transformedAst = transform(ast);
  const compiledSource = print(transformedAst).code;

  return compiledSource;
}