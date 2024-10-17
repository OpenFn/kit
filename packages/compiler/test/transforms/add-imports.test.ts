import test from 'ava';
import path from 'node:path';
import { namedTypes as n, builders as b } from 'ast-types';

import parse from '../../src/parse';
import transform from '../../src/transform';
import addImports, {
  findAllDanglingIdentifiers,
} from '../../src/transforms/add-imports';
import { preloadAdaptorExports } from '../../src/util';

test('findAllDanglingIdentifiers: x;', (t) => {
  const ast = parse('x;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
});

test('findAllDanglingIdentifiers: x();', (t) => {
  const ast = parse('x();');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
});

test('findAllDanglingIdentifiers: x = x', (t) => {
  const ast = parse('x = x;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
});

test('findAllDanglingIdentifiers: x = y', (t) => {
  const ast = parse('x = y;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 2);
  t.truthy(result['x']);
  t.truthy(result['y']);
});

test('findAllDanglingIdentifiers: x;y();', (t) => {
  const ast = parse('x;y();');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 2);
  t.truthy(result['x']);
  t.truthy(result['y']);
});

test('findAllDanglingIdentifiers: x.y;', (t) => {
  const ast = parse('x.y;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
  t.falsy(result['y']);
});

test('findAllDanglingIdentifiers: x.y.z;', (t) => {
  const ast = parse('x.y.z;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
});

test('findAllDanglingIdentifiers: x.y.z.a;', (t) => {
  const ast = parse('x.y.z;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
  t.falsy(result['a']);
});

test('findAllDanglingIdentifiers: x.y();', (t) => {
  const ast = parse('x.y();');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
  t.falsy(result['y']);
});

test('findAllDanglingIdentifiers: x().y;', (t) => {
  const ast = parse('x().y;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
  t.falsy(result['y']);
});

test('findAllDanglingIdentifiers: x.y().z;', (t) => {
  const ast = parse('x.y().z;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
});

test('findAllDanglingIdentifiers: x().y.z;', (t) => {
  const ast = parse('x.y().z;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
});

test('findAllDanglingIdentifiers: x.y.z();', (t) => {
  const ast = parse('x.y.z();');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['x']);
  t.falsy(result['y']);
  t.falsy(result['z']);
});

test('findAllDanglingIdentifiers: const x = 1;', (t) => {
  const ast = parse('const x = 1;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: let x = 1, y = 2;', (t) => {
  const ast = parse('let x = 1, y = 2;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: const { x } = obj;', (t) => {
  const ast = parse('const { x } = obj;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['obj']);
});

test('findAllDanglingIdentifiers: const x = { a };', (t) => {
  const ast = parse('const x = { a };');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: const x = { a: 10 };', (t) => {
  const ast = parse('const x = { a: 10 };');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: const x = { a: b };', (t) => {
  const ast = parse('const x = { a: b };');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['b']);
});

test('findAllDanglingIdentifiers: const a = {}; const x = { ...a };', (t) => {
  const ast = parse('const a = {}; const x = { ...a };');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: export default (a) => a;', (t) => {
  const ast = parse('export default (a) => a;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: export default () => a;', (t) => {
  const ast = parse('export default () => a;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 1);
  t.truthy(result['a']);
});

test('findAllDanglingIdentifiers: function f(a) { a; };', (t) => {
  const ast = parse('function f(a) { a; };');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: import { fn } from "fn"; fn;', (t) => {
  const ast = parse('import { fn } from "fn"; fn;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: import * as fn from "fn"; fn;', (t) => {
  const ast = parse('import * as fn from "fn"; fn;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: const x = undefined;', (t) => {
  const ast = parse('const x = undefined;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: const x = true | false | null | NaN;', (t) => {
  const ast = parse('const x = true | false | null | NaN;');
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 0);
});

test('findAllDanglingIdentifiers: nested scoping', (t) => {
  const ast = parse(`fn((a) => {
    const x = 1;
    a;
    const f = () => {
      x;
      a;
      z; // dangling
    };
  })`);
  const result = findAllDanglingIdentifiers(ast);
  t.assert(Object.keys(result).length == 2);
  t.truthy(result['z']);
  t.truthy(result['fn']);
  t.falsy(result['a']);
  t.falsy(result['x']);
  t.falsy(result['y']);
});

test('add imports for a test module', async (t) => {
  const ast = b.program([
    b.expressionStatement(b.identifier('x')),
    b.expressionStatement(b.identifier('y')),
  ]);

  const exports = await preloadAdaptorExports(
    path.resolve('test/__modules__/adaptor')
  );

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
          exports: exports,
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  const imports = (first as n.ImportDeclaration)
    .specifiers as n.ImportSpecifier[];
  t.assert(imports.length === 2);
  t.assert(imports.find((i) => i.imported.name === 'x'));
  t.assert(imports.find((i) => i.imported.name === 'y'));
});

test('only add used imports for a test module', async (t) => {
  const ast = b.program([b.expressionStatement(b.identifier('x'))]);

  const exports = await preloadAdaptorExports(
    path.resolve('test/__modules__/adaptor')
  );

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
          exports: exports,
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  const imports = (first as n.ImportDeclaration)
    .specifiers as n.ImportSpecifier[];
  t.assert(imports.length === 1);
  t.assert(imports.find((i) => i.imported.name === 'x'));
});

test("don't add imports if nothing is used", async (t) => {
  const ast = b.program([]);

  const exports = await preloadAdaptorExports(
    path.resolve('test/__modules__/adaptor')
  );

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
          exports: exports,
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  t.assert(transformed.body.length === 0);
});

test('add imports for multiple adaptors', async (t) => {
  const ast = b.program([
    b.expressionStatement(b.identifier('x')),
    b.expressionStatement(b.identifier('y')),
  ]);

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'adaptor-a',
          exports: ['x'],
        },
        {
          name: 'adaptor-b',
          exports: ['y'],
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  // Note that the first is y, and the second is x
  const [first, second] = transformed.body as [
    n.ImportDeclaration,
    n.ImportDeclaration
  ];
  t.assert(n.ImportDeclaration.check(first));
  const imports_1 = first.specifiers as n.ImportSpecifier[];
  t.assert(imports_1.length === 1);
  t.assert(imports_1.find((i) => i.imported.name === 'y'));
  t.is(first.source.value, 'adaptor-b');

  t.assert(n.ImportDeclaration.check(second));
  const imports_2 = (second as n.ImportDeclaration)
    .specifiers as n.ImportSpecifier[];
  t.assert(imports_2.length === 1);
  t.assert(imports_2.find((i) => i.imported.name === 'x'));
  t.is(second.source.value, 'adaptor-a');
});

test("don't import if a variable is declared with the same name", async (t) => {
  const ast = b.program([
    b.variableDeclaration('const', [b.variableDeclarator(b.identifier('x'))]),
  ]);

  const exports = await preloadAdaptorExports(
    path.resolve('test/__modules__/adaptor')
  );

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
          exports: exports,
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;
  t.assert(transformed.body.length === 1);
});

test('dumbly add imports for an adaptor with empty exports', (t) => {
  const ast = b.program([
    b.expressionStatement(b.identifier('x')),
    b.expressionStatement(b.identifier('y')),
  ]);

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
          exports: [],
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  const imports = (first as n.ImportDeclaration)
    .specifiers as n.ImportSpecifier[];
  t.assert(imports.length === 2);
  t.assert(imports.find((i) => i.imported.name === 'x'));
  t.assert(imports.find((i) => i.imported.name === 'y'));
});

test('dumbly add imports for an adaptor with unknown exports', (t) => {
  const ast = b.program([
    b.expressionStatement(b.identifier('x')),
    b.expressionStatement(b.identifier('y')),
  ]);

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  const imports = (first as n.ImportDeclaration)
    .specifiers as n.ImportSpecifier[];
  t.assert(imports.length === 2);
  t.assert(imports.find((i) => i.imported.name === 'x'));
  t.assert(imports.find((i) => i.imported.name === 'y'));
});

test("don't auto add imports for node globals", (t) => {
  // Note that this is not an exhaustive set
  const globals = [
    'atob',
    'Blob',
    'btoa',
    'Buffer',
    'clearInterval',
    'clearTimeout',
    'console',
    'Date',
    'Error',
    'Event',
    'exports',
    'isNaN',
    'global',
    'JSON',
    'Map',
    'module',
    'NaN',
    'parseFloat',
    'parseInt',
    'process',
    'Promise',
    'require',
    'Set',
    'setInterval',
    'setTimeout',
    'state',
    'URL',
  ];
  const ast = b.program(
    [b.expressionStatement(b.identifier('x'))].concat(
      globals.map((g) => b.expressionStatement(b.identifier(g)))
    )
  );

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
          exports: [],
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  const imports = (first as n.ImportDeclaration)
    .specifiers as n.ImportSpecifier[];
  t.assert(imports.length == 1);
  t.assert(imports[0].imported.name === 'x');
});

test("Don't add imports for ignored identifiers", async (t) => {
  const ast = b.program([
    b.expressionStatement(b.identifier('x')),
    b.expressionStatement(b.identifier('y')),
  ]);

  const options = {
    'add-imports': {
      ignore: ['x'],
      adaptors: [
        {
          name: 'test-adaptor',
          exports: [],
        },
      ],
    },
  };

  const transformed = transform(ast, [addImports], options) as n.Program;

  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  const imports = (first as n.ImportDeclaration)
    .specifiers as n.ImportSpecifier[];
  t.assert(imports.length === 1);
  t.assert(imports[0].imported.name === 'y');
});

test("Don't add imports from import specifiers", async (t) => {
  const ast = b.program([
    b.importDeclaration(
      [
        b.importSpecifier(b.identifier('x')),
        b.importSpecifier(b.identifier('y'), b.identifier('_y')),
      ],
      b.stringLiteral('@openfn/runtime')
    ),
  ]);

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
          exports: [],
        },
      ],
    },
  };

  const transformed = transform(ast, [addImports], options) as n.Program;

  t.assert(transformed.body.length === 1);
  const [first] = transformed.body;
  t.assert(n.ImportDeclaration.check(first));
  t.assert(first.source.value === '@openfn/runtime');
});

test('export everything from an adaptor', (t) => {
  const ast = b.program([b.expressionStatement(b.identifier('x'))]);

  const options = {
    'add-imports': {
      adaptors: [
        {
          name: 'test-adaptor',
          exportAll: true,
        },
      ],
    },
  };
  const transformed = transform(ast, [addImports], options) as n.Program;

  // Should be three statements now
  t.assert(transformed.body.length == 3);
  const imp = transformed.body[0] as n.ImportDeclaration;
  const ex = transformed.body[1] as n.ExportAllDeclaration;
  const stmt = transformed.body[2] as n.ExpressionStatement;

  // An import * from
  t.assert(n.ImportDeclaration.check(imp));
  const specs = imp.specifiers as n.ImportSpecifier[];
  t.assert(specs.length == 1);
  t.assert(specs[0].imported.name === 'x');

  // An export * from
  t.assert(n.ExportAllDeclaration.check(ex));
  t.assert(ex.source.value === 'test-adaptor');

  // And the original statement
  t.assert(n.ExpressionStatement.check(stmt));
});
