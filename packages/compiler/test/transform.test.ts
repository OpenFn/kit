import test from 'ava';
import { builders as b } from 'ast-types';

import transform, { TransformerName } from '../src/transform';

const TEST = 'test' as TransformerName;
const ENSURE_EXPORTS = 'ensure-exports' as TransformerName;

test('transform will visit nodes once', (t) => {
  let visitCount = 0;
  const visitor = () => {
    visitCount++;
  };
  const transformers = [{ id: TEST, types: ['CallExpression'], visitor }];

  const program = b.program([
    b.expressionStatement(b.callExpression(b.identifier('jam'), [])),
  ]);

  transform(program, transformers);
  t.assert(visitCount === 1);
});

test('visit with mutiple transformes', (t) => {
  let callCount = 0;
  let idCount = 0;

  const transformers = [
    {
      id: '1' as TransformerName,
      types: ['CallExpression'],
      visitor: () => {
        callCount++;
      },
    },
    {
      id: '2' as TransformerName,
      types: ['Identifier'],
      visitor: () => {
        idCount++;
      },
    },
  ];

  const program = b.program([
    b.expressionStatement(b.callExpression(b.identifier('jam'), [])),
  ]);

  transform(program, transformers);
  t.is(callCount, 1);
  t.is(idCount, 1);
});

test('run transformers in order', (t) => {
  const results: number[] = [];

  const transformers = [
    {
      id: '1' as TransformerName,
      types: ['Identifier'],
      visitor: () => {
        results.push(1);
      },
      order: 2,
    },
    {
      id: '2' as TransformerName,
      types: ['Identifier'],
      visitor: () => {
        results.push(2);
      },
      order: 1,
    },
    {
      id: '3' as TransformerName,
      types: ['Identifier'],
      visitor: () => {
        results.push(3);
      },
      // order defaults to 1, so we shouldn't need to set this
      //order: 1,
    },
    {
      id: '4' as TransformerName,
      types: ['Identifier'],
      visitor: () => {
        results.push(4);
      },
      order: 0,
    },
  ];

  const program = b.program([b.expressionStatement(b.identifier('jam'))]);

  transform(program, transformers);
  t.deepEqual(results, [4, 2, 3, 1]);
});

test('transform will visit nested nodes', (t) => {
  let visitCount = 0;
  const visitor = () => {
    visitCount++;
  };
  const transformers = [{ id: TEST, types: ['CallExpression'], visitor }];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(b.callExpression(b.identifier('jam'), []), [])
    ),
  ]);
  transform(program, transformers);
  t.assert(visitCount === 2);
});

test('transform will stop if a visitor returns truthy', (t) => {
  let visitCount = 0;
  const visitor = () => Boolean(++visitCount);
  const transformers = [{ id: TEST, types: ['CallExpression'], visitor }];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(b.callExpression(b.identifier('jam'), []), [])
    ),
  ]);
  transform(program, transformers);
  t.assert(visitCount === 1);
});

test('one transform stopping does not affect another', (t) => {
  let callCount = 0;
  let idCount = 0;

  const transformers = [
    {
      id: '1' as TransformerName,
      types: ['CallExpression'],
      visitor: () => {
        callCount++;
        return true;
      },
    },
    {
      id: '2' as TransformerName,
      types: ['Identifier'],
      visitor: () => {
        idCount++;
      },
    },
  ];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(b.callExpression(b.identifier('jam'), []), [])
    ),
  ]);
  transform(program, transformers);
  t.assert(callCount === 1);
  t.assert(idCount === 1);
});

test('ignore transformers disabled in options', (t) => {
  let visitCount = 0;
  const transformers = [
    {
      id: TEST,
      types: ['Identifier'],
      visitor: () => {
        ++visitCount;
      },
    },
  ];

  const program = b.program([
    b.expressionStatement(b.callExpression(b.identifier('jam'), [])),
  ]);

  transform(program, transformers, { [TEST]: false });

  t.is(visitCount, 0);
});

test('passes options to a transformer', (t) => {
  let result;
  const visitor = (_node: unknown, _logger: unknown, options: any) => {
    result = options.value;
  };
  const transformers = [{ id: TEST, types: ['Program'], visitor }];

  const options = { [TEST]: { value: 42 } };

  const program = b.program([]);

  // Visit an AST and ensure the visitor is called with the right options
  transform(program, transformers, options);

  t.is(result, 42);
});

test('passes options to several transformers', (t) => {
  let total = 0;
  const visitor = (_node: unknown, _logger: unknown, options: any) => {
    total += options.value;
  };
  const transformers = [
    { id: TEST, types: ['Program'], visitor },
    { id: TEST, types: ['Program'], visitor },
  ];

  // Build a visitor map which should trap the options
  const options = { [TEST]: { value: 2 } };
  const program = b.program([]);

  // Visit an AST and ensure the visitor is called with the right options
  transform(program, transformers, options);

  t.is(total, 4);
});

test('passes options to the correct visitor', (t) => {
  let x;
  let y;

  const visitor_a = (_node: unknown, _logger: unknown, options: any) => {
    x = options.value;
  };
  const visitor_b = (_node: unknown, _logger: unknown, options: any) => {
    y = options.value;
  };

  const transformers = [
    { id: ENSURE_EXPORTS, types: ['Program'], visitor: visitor_a },
    { id: TEST, types: ['Program'], visitor: visitor_b },
  ];

  // Build a visitor map which should trap the options
  const options = {
    [ENSURE_EXPORTS]: { value: 99 }, // x
    [TEST]: { value: 42 }, // y
  };

  const program = b.program([]);

  // Visit an AST and ensure the visitor is called with the right options
  transform(program, transformers, options);

  t.is(x, 99);
  t.is(y, 42);
});
