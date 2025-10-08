import test, { ExecutionContext } from 'ava';
import { print } from 'recast';
import { namedTypes, NodePath, builders as b } from 'ast-types';

import parse from '../../src/parse';

import transform from '../../src/transform';
import visitors from '../../src/transforms/lazy-state';

test('convert a simple dollar reference', (t) => {
  const ast = parse('get($.data)');
  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, 'get(state => state.data)');
});

test.only("don't visit top-level object", (t) => {
  const ast = parse(`const x = { x: $.data };
fn($.data)`);
  t.notThrows(() => {
    const transformed = transform(ast, [visitors]);
    const { code } = print(transformed);
    t.is(
      code,
      `const x = { x: $.data };
fn(state => state.data)`
    );
  });
});

test('convert a chained dollar reference', (t) => {
  const ast = parse('get($.a.b.c.d)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, 'get(state => state.a.b.c.d)');
});

test('ignore a regular chain reference', (t) => {
  const ast = parse('get(a.b.c.d)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, 'get(a.b.c.d)');
});

test('convert a template literal', (t) => {
  const src = 'get(`hello ${$.data}`)';
  t.log(src);
  const ast = parse(src);
  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);
  t.log(code);

  t.is(code, 'get(state => `hello ${state.data}`)');
});

test('convert a template literal with two refs', (t) => {
  const src = 'get(`hello ${$.firstname} ${$.lastname}`)';
  t.log(src);
  const ast = parse(src);
  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);
  t.log(code);

  t.is(code, 'get(state => `hello ${state.firstname} ${state.lastname}`)');
});

test('convert a template literal with a pre-existing parent arrow', (t) => {
  const src = 'get(state => `hello ${$.data}`)';
  t.log(src);
  const ast = parse(src);
  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);
  t.log(code);

  t.is(code, 'get(state => `hello ${state.data}`)');
});

test('throw if a $ is already inside a non-compatible arrow (state name)', (t) => {
  const src = 'get((s) => `hello ${$.data}`)'; // throw!!
  t.log(src);
  const ast = parse(src);

  t.throws(() => transform(ast, [visitors]), {
    message: `invalid state operator: parameter "s" should be called "state"`,
  });
});

test('throw if a $ is already inside a non-compatible arrow (arity)', (t) => {
  const src = 'get((state, b) => `hello ${$.data}`)'; // throw!!
  t.log(src);
  const ast = parse(src);

  t.throws(() => transform(ast, [visitors]), {
    message: 'invalid state operator: parent has wrong arity',
  });
});

test('throw if $ is not inside an operation', (t) => {
  const src = 'const x = $.data;'; // throw!!
  t.log(src);
  const ast = parse(src);

  t.throws(() => transform(ast, [visitors]), {
    message: 'invalid state operator: must be inside an expression',
  });
});

test('throw if $ is on the left hand side of an assignment', (t) => {
  const src = '$.data = 20;'; // throw!!
  t.log(src);
  const ast = parse(src);

  t.throws(() => transform(ast, [visitors]), {
    message: 'invalid state operator: must be inside an expression',
  });
});

test('throw if $ is on the left hand side of a nested assignment', (t) => {
  const src = 'fn(() => { $.data = 20; })'; // throw!!
  t.log(src);
  const ast = parse(src);

  t.throws(() => transform(ast, [visitors]), {
    message: 'invalid state operator: must be inside an expression',
  });
});

test('throw if $ is on the left hand side of a multi assignment', (t) => {
  const src = 'const z = $.data = 20;'; // throw!!
  t.log(src);
  const ast = parse(src);

  t.throws(() => transform(ast, [visitors]), {
    message: 'invalid state operator: must be inside an expression',
  });
});

test('wrap a concatenation', (t) => {
  const src = 'get($.firstname + " " + $.lastname)';
  t.log(src);
  const ast = parse(src);
  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);
  t.log(code);

  t.is(code, 'get(state => state.firstname + " " + state.lastname)');
});

test('wrap a dynamic property reference', (t) => {
  const src = 'get(city[$.location])';
  t.log(src);
  const ast = parse(src);
  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);
  t.log(code);

  t.is(code, 'get(state => city[state.location])');
});

test('ignore a dollar ref in a string', (t) => {
  const ast = parse('get("$.a.b")');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, 'get("$.a.b")');
});

// TODO do we want to support this?
test('convert a nested dollar reference', (t) => {
  const ast = parse(`fn(() => {
  get($.data)
})`);

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  // syntax starts getting a but picky at this level,
  // better to do ast tests
  t.is(
    code,
    `fn(() => {
  get(state => state.data)
})`
  );
});

test('do not convert a $ var (param)', (t) => {
  const src = `fn(($) => {
    return $.a.b;
  })`;
  const ast = parse(src);

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, src);
});

test('do not convert a $ var (const)', (t) => {
  const src = `fn((s) => {
    const $ = 10;
    s.data = $.a.b
    return s;
  })`;
  const ast = parse(src);

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, src);
});

test('convert an optional chained simple dollar reference', (t) => {
  const ast = parse('get($.a?.b.c.d)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, 'get(state => state.a?.b.c.d)');
});

test('convert logical not', (t) => {
  const ast = parse('get(!$.data.x)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, 'get(state => !state.data.x)');
});

test('convert function call on state', (t) => {
  const ast = parse('fn($.callMeMaybe())');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, 'fn(state => state.callMeMaybe())');
});

test('convert function call on state with state argument', (t) => {
  const ast = parse('fn($.callMeMaybe($.age))');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed);

  t.is(code, 'fn(state => state.callMeMaybe(state.age))');
});
