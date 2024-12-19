import test from 'ava';
import recast from 'recast';
import getMappedPosition from '../../src/util/get-mapped-position';

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
  t.is(result.line, 1);
  t.is(result.column, 0);
});
