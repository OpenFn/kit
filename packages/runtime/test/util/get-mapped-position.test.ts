import test from 'ava';
import recast from 'recast';
import getMappedPosition, { mapStackTrace } from '../../src/util/get-mapped-position';

const b = recast.types.builders;

// compile an expression into a function
const compile = (src: string) => {
  const ast = recast.parse(src, {
    sourceFileName: 'src.js',
  });

  // take the expression and wrap it in a function declaration
  const [{ expression }] = ast.program.body;
  const fn = b.functionDeclaration(
    b.identifier('fn'),
    [],
    b.blockStatement([b.returnStatement(expression)])
  );

  ast.program.body.push(fn);

  return recast.print(fn, {
    sourceMapName: 'src.map.js',
  });
};

test('should return a sourcemapped position', async (t) => {
  // Compile this simple expression into a function
  const { code, map } = compile('x + 1');
  // Now work out where x is
  const lines = code.split('\n');
  const line = 2; // line is 1 based
  const column = lines[1].indexOf('x');

  // now get the uncompiled position for x
  const result = await getMappedPosition(map, line, column);

  // now check the position
  t.is(result.line, 2);
  t.is(result.col, 0);
});

test('should map positions in a stack trace', async (t) => {
  const src = `fn((x) => z)`;
  
  // compile the code with a source map
  const { map, code } = compile(src);
  t.log(code)
  
  // Find the column positions of x and z
  // We'll make arbitrary mappings for those positions;
  const lines = code.split('\n')
  const zPos = lines[1].indexOf('z')
  const xPos = lines[1].indexOf('x')
  
  // here's a fake but vaguely plausible stack trace
  const rawStack = `ReferenceError: z is not defined
  at vm:module(0):2:${zPos}
  at fn (vm:module(0):2:${xPos}`;
  
  const result = await mapStackTrace(map, rawStack)
  t.log(result)
  
  // Here's what we expect in the original
  const mappedStack = `ReferenceError: z is not defined
  at vm:module(0):1:${src.indexOf('z')}
  at fn (vm:module(0):1:${src.indexOf('x')})`;
  
  // TODO for some reason the result comes out on line 2, but there's only one original line of source?
  // col mapping looks fine??
  t.is(result, mappedStack)

});
