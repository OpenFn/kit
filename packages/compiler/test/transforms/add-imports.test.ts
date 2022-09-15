import test from 'ava';
import path from 'node:path';
import { namedTypes as n, builders as b } from 'ast-types';
import parse from '../../src/parse';
import transform from '../../src/transform';
import addImports, { findAllDanglingIdentifiers } from '../../src/transforms/add-imports';
import { preloadAdaptorExports } from '../../src/util';
import { visit } from 'recast';

test('visits a Program node', (t) => {
  let visitCount = 0;
  const mockVisitors = [{
    types: addImports.types,
    visitor: () => { visitCount++; }
  }];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(
        b.identifier('fn'),
        []
      )
    )
  ]);

  transform(program, mockVisitors);
  t.assert(visitCount === 1)
});

test('findAllDanglingIdentifiers can find an identifier', (t) => {
  const ast = parse("x;")
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1)
  t.truthy(result['x']);
});

test('findAllDanglingIdentifiers can find an identifier in a call expression', (t) => {
  const ast = parse("x();")
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1)
  t.truthy(result['x']);
});

test('findAllDanglingIdentifiers can find duplicate identifiers', (t) => {
  const ast = parse("x = x;")
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1)
  t.truthy(result['x']);
});

test('findAllDanglingIdentifiers can find multiple identifiers', (t) => {
  const ast = parse("x;y();")
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 2)
  t.truthy(result['x']);
  t.truthy(result['y']);
});

test('findAllDanglingIdentifiers only returns the object of a simple member expressions', (t) => {
  const ast = parse("x.y;")
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1)
  t.truthy(result['x']);
  t.falsy(result['y']);
});

// TODO this fails
test.skip('findAllDanglingIdentifiers only returns the top object of nested member expressions', (t) => {
  const ast = parse("x.y.z;")
  const result = findAllDanglingIdentifiers(ast);
  console.log(result)
  t.assert(Object.keys(result).length == 1)
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
});

test('findAllDanglingIdentifiers only returns the top object of a method call', (t) => {
  const ast = parse("x.y();")
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1)
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
});

// TODO this fails
test.skip('findAllDanglingIdentifiers only returns the top object of a call inside a member expression', (t) => {
  const ast = parse("x().y;")
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1)
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
});

// TODO this fails
test.skip('findAllDanglingIdentifiers only returns the top object of a nested method call', (t) => {
  const ast = parse("x.y().z();")
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1)
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
});

// test.only('findAllDanglingIdentifiers can find deeply nested identifiers', (t) => {
//   const ast = parse(`fn(() => {
//     const f = () => {
//       x;
//     }
//   })`);
//   const result = findAllDanglingIdentifiers(ast);
//   t.assert(Object.keys(result).length == 1)
//   t.truthy(result['x']);
// })

test('findAllDanglingIdentifiers ignores variable declarations', (t) => {
  const ast = parse('const x = 1;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0)
});

test('findAllDanglingIdentifiers ignores identifiers declared in scope', (t) => {
  const ast = parse(`fn(() => {
    const f = (a) => {
      a;
      const x = 1;
      x;
      let y = 2;
      y;

      z; // find this only
    };
  })`);
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 2)
  t.truthy(result['z']);
  t.truthy(result['fn']);
  t.falsy(result['a']);
  t.falsy(result['x']);
  t.falsy(result['y']);
})

test('findAllDanglingIdentifiers ignores identifiers declared in a parent scope', (t) => {
  const ast = parse(`fn((a) => {
    const x = 1;
    let y = 2;
    const f = () => {
      x;
      y;

      z; // find this only
    };
  })`);
  const result = findAllDanglingIdentifiers(ast);
  console.log(result)
  t.assert(Object.keys(result).length == 2)
  t.truthy(result['z']);
  t.truthy(result['fn']);
  t.falsy(result['a']);
  t.falsy(result['x']);
  t.falsy(result['y']);
})

test('add imports for a test module', async (t) => {
  const ast = b.program([
    b.expressionStatement(b.identifier('x')),
    b.expressionStatement(b.identifier('y')),
  ]);

  const exports = await preloadAdaptorExports(path.resolve('test/__modules__/adaptor'))

  const options = {
    'add-imports': {
      adaptor: {
        name: 'test-adaptor',
        exports: exports,
      }
    }
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  const imports = (first as n.ImportDeclaration).specifiers;
  t.assert(imports.length === 2);
  t.assert(imports?.find(i => i.imported.name === 'x'));
  t.assert(imports?.find(i => i.imported.name === 'y'));
});

test('only add used imports for a test module', async (t) => {
  const ast = b.program([
    b.expressionStatement(b.identifier('x')),
  ]);

  const exports = await preloadAdaptorExports(path.resolve('test/__modules__/adaptor'))

  const options = {
    'add-imports': {
      adaptor: {
        name: 'test-adaptor',
        exports: exports,
      }
    }
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  const imports = (first as n.ImportDeclaration).specifiers;
  t.assert(imports.length === 1);
  t.assert(imports?.find(i => i.imported.name === 'x'));
});

test('don\'t add imports if nothing is used', async (t) => {
  const ast = b.program([]);

  const exports = await preloadAdaptorExports(path.resolve('test/__modules__/adaptor'))

  const options = {
    'add-imports': {
      adaptor: {
        name: 'test-adaptor',
        exports: exports,
      }
    }
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  t.assert(transformed.body.length === 0);
});

test('don\'t import if a variable is declared with the same name', async (t) => {
  const ast = b.program([
    b.variableDeclaration(
      "const",
      [b.variableDeclarator(b.identifier('x'))]
    )
  ]);

  const exports = await preloadAdaptorExports(path.resolve('test/__modules__/adaptor'))

  const options = {
    'add-imports': {
      adaptor: {
        name: 'test-adaptor',
        exports: exports,
      }
    }
  };
  const transformed = transform(ast, [addImports], options) as n.Program;
  t.assert(transformed.body.length === 1);
});