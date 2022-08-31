import { print } from 'recast';
import parse from './parse';
import transform from './transform';
import { loadFile } from './utils';

type Options = {
  // Evaluate the input path as source, rather than loading from disk
  // TODO not keen on the name of this
  // Can we not detect a file name? No line breaks, ends in js or maybe ojs
  eval?: boolean;
}

// This is the main compiler function
// Load source from a file
// parse it
// transform it
// write it (with recast)
// TODO should this be async? not sure yet there's any need
export default function compile(path: string, opts: Options = {}) {
  const source = opts.eval ? path : loadFile(path);

  const ast = parse(source);
  const transformedAst = transform(ast);
  const compiledSource = print(transformedAst).code;

  return compiledSource;
}