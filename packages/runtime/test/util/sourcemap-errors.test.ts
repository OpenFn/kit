import test from 'ava';
import recast from 'recast';
import mapErrors from '../../src/util/sourcemap-errors';
import { RTError } from '../../src';

const b = recast.types.builders;

// compile an expression into a function
const compile = (src: string, sourceFileName = 'src.js') => {
  const ast = recast.parse(src, {
    sourceFileName,
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
    sourceMapName: `${sourceFileName.replace('.js', '.map.js')}`,
  });
};

test('should write the step name to the error', async (t) => {
  const { code, map } = compile('x + 1', 'yyy.js');

  // create a fake job
  const job = {
    expression: code,
    sourceMap: map,
    name: 'yyy',
  };

  // create a fake Error coming from the compiled 'x'
  const error = new RTError();
  error.pos = {
    line: 2,
    column: code.split('\n')[1].indexOf('x'),
  };

  await mapErrors(job, error);
  // Error should now be mapped to the old position
  t.is(error.step, 'yyy');
});

test('should re-write the position and source line of an error', async (t) => {
  // Compile this simple expression into a function
  const { code, map } = compile('x + 1');
  const lines = code.split('\n');

  // create a fake job
  const job = {
    expression: code,
    sourceMap: map,
  };

  // create a fake Error coming from the compiled 'x'
  const error = new RTError();
  (error as any).pos = {
    line: 2,
    column: lines[1].indexOf('x'),
  };
  t.log(error);

  await mapErrors(job, error);

  // Error should now be mapped to the old position
  t.deepEqual(error.pos, {
    line: 1,
    column: 0,
    src: 'x + 1',
  });
});

test('should map positions in a stack trace', async (t) => {
  const src = `fn((x) => z)`;

  // compile the code with a source map
  const { map, code } = compile(src);

  // create a fake job
  const job = {
    expression: code,
    sourceMap: map,
  };

  // Find the column positions of x and z
  // We'll make arbitrary mappings for those positions;
  const lines = code.split('\n');
  const zPos = lines[1].indexOf('z');
  const xPos = lines[1].indexOf('x');

  const error = new RTError();
  (error as any).pos = {
    line: 2,
    column: lines[1].indexOf('x'),
  };
  // here's a fake but vaguely plausible stack trace
  error.stack = `ReferenceError: z is not defined
  at vm:module(0):2:${zPos}
  at fn (vm:module(0):2:${xPos})`;

  await mapErrors(job, error);
  t.log(error.stack);

  // Here's what we expect in the original
  const mappedStack = `ReferenceError: z is not defined
  at vm:module(0):1:${src.indexOf('z')}
  at fn (vm:module(0):1:${src.indexOf('x')})`;

  t.is(error.stack, mappedStack);
});

test("should preserve stack trace positions if it can't map them", async (t) => {
  const src = `fn((x) => z)`;

  // compile the code with a source map
  const { map, code } = compile(src);

  // create a fake job
  const job = {
    expression: code,
    sourceMap: map,
  };

  const error = new RTError();
  (error as any).pos = {
    line: 2,
    column: 2,
  };

  error.stack = `ReferenceError: z is not defined
  at @openfn/language-http_6.5.1/dist/index.cjs:201:22
  at fn ( @openfn/language-http_6.5.1/dist/index.cjs):1192:7`;

  const mappedStack = error.stack;

  await mapErrors(job, error);
  t.log(error.stack);

  t.is(error.stack, mappedStack);
});
