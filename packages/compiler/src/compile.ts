// This is the main compiler function
// Load source from a file
// parse it
// transform it
// write it (with recast)

import { loadFile } from './utils';
import { print } from 'recast';

import parse from './parse';
import transform from './transform';

type Options = {
  // Evaluate the input path as source, rather than loading from disk
  eval?: boolean;
}

// TODO should this be async?
export default function compile(path: string, opts: Options) {
  let source;
  if (!opts.eval) {
    source = loadFile(path);
  } else {
    source = path;
  }

  const ast = parse(source);
  const transformedAst = transform(ast);
  const compiledSource = print(transformedAst).code;

  return compiledSource;
}