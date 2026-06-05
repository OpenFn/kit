import test from 'ava';
import { builders as b, namedTypes as n } from 'ast-types';
import { print } from 'recast';
import transform from '../../src/transform';
import visitors, {
  collectRefs,
  buildDeclMap,
  collectDeps,
} from '../../src/transforms/exports-only';

// Helpers
const makeConst = (name: string, value: any = b.literal(42)) =>
  b.variableDeclaration('const', [
    b.variableDeclarator(b.identifier(name), value),
  ]);

const makeExportConst = (name: string, value: any = b.literal(42)) =>
  b.exportNamedDeclaration(makeConst(name, value), []);

const makeExportFn = (
  name: string,
  body: any[] = [b.returnStatement(b.literal(1))]
) =>
  b.exportNamedDeclaration(
    b.functionDeclaration(b.identifier(name), [], b.blockStatement(body)),
    []
  );

const makeOp = (name: string) =>
  b.expressionStatement(b.callExpression(b.identifier(name), []));

const makeImport = (specifier: string, source: string) =>
  b.importDeclaration(
    [b.importSpecifier(b.identifier(specifier))],
    b.stringLiteral(source)
  );

// --- collectRefs ---

test('collectRefs: finds identifiers in a simple expression', (t) => {
  const node = b.expressionStatement(
    b.callExpression(b.identifier('fn'), [b.identifier('x')])
  );
  const refs = collectRefs(node);
  t.true(refs.has('fn'));
  t.true(refs.has('x'));
});

test('collectRefs: traverses nested nodes', (t) => {
  const node = b.arrowFunctionExpression(
    [],
    b.callExpression(b.identifier('helper'), [])
  );
  const refs = collectRefs(node);
  t.true(refs.has('helper'));
});

// --- buildDeclMap ---

test('buildDeclMap: maps variable declarations', (t) => {
  const decl = makeConst('myVar');
  const map = buildDeclMap([decl]);
  t.true(map.has('myVar'));
  t.is(map.get('myVar'), decl);
});

test('buildDeclMap: maps function declarations', (t) => {
  const decl = b.functionDeclaration(
    b.identifier('myFn'),
    [],
    b.blockStatement([])
  );
  const map = buildDeclMap([decl]);
  t.true(map.has('myFn'));
});

test('buildDeclMap: ignores export declarations', (t) => {
  const decl = makeExportConst('exported');
  const map = buildDeclMap([decl]);
  t.false(map.has('exported'));
});

// --- collectDeps ---

test('collectDeps: includes seeds in result', (t) => {
  const seed = makeConst('x');
  const result = collectDeps([seed], new Map());
  t.true(result.has(seed));
});

test('collectDeps: transitively follows dependencies', (t) => {
  const dep = makeConst('helper');
  const declMap = new Map([['helper', dep]]);
  const seed = b.exportNamedDeclaration(
    b.functionDeclaration(
      b.identifier('doThing'),
      [],
      b.blockStatement([
        b.returnStatement(b.callExpression(b.identifier('helper'), [])),
      ])
    ),
    []
  );
  const result = collectDeps([seed], declMap);
  t.true(result.has(dep));
});

// --- exports-only transformer ---

test('is a no-op when options is not true', (t) => {
  const ast = b.program([
    makeOp('fn'),
    b.exportDefaultDeclaration(b.arrayExpression([])),
  ]);
  const before = print(ast).code;
  const after = print(transform(ast, [visitors])).code;
  t.is(before, after);
});

test('is a no-op when options is false', (t) => {
  const ast = b.program([makeOp('fn')]);
  const before = print(ast).code;
  const after = print(
    transform(ast, [visitors], { 'exports-only': false })
  ).code;
  t.is(before, after);
});

test('strips operation calls', (t) => {
  const ast = b.program([makeOp('get'), makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 0);
});

test('strips export default []', (t) => {
  const ast = b.program([
    makeOp('fn'),
    b.exportDefaultDeclaration(b.arrayExpression([])),
  ]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 0);
});

test('strips non-exported declarations', (t) => {
  const ast = b.program([makeConst('x'), makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 0);
});

test('keeps import declarations', (t) => {
  const imp = makeImport('get', '@openfn/language-http');
  const ast = b.program([imp, makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 1);
  t.true(n.ImportDeclaration.check(body[0]));
});

test('keeps named export declarations', (t) => {
  const exported = makeExportConst('helper');
  const ast = b.program([exported, makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 1);
  t.true(n.ExportNamedDeclaration.check(body[0]));
});

test('keeps exported function declarations', (t) => {
  const ast = b.program([makeExportFn('formatDate'), makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 1);
  t.true(n.ExportNamedDeclaration.check(body[0]));
});

test('keeps non-exported declarations that an export depends on', (t) => {
  const helper = makeConst(
    'fmt',
    b.arrowFunctionExpression([b.identifier('d')], b.identifier('d'))
  );
  const exported = makeExportFn('formatDate', [
    b.returnStatement(
      b.callExpression(b.identifier('fmt'), [b.identifier('date')])
    ),
  ]);
  const ast = b.program([helper, exported, makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 2);
  t.true(n.VariableDeclaration.check(body[0]));
  t.true(n.ExportNamedDeclaration.check(body[1]));
});

test('drops non-exported declarations that no export depends on', (t) => {
  const unused = makeConst('unused');
  const exported = makeExportFn('greet', [
    b.returnStatement(b.stringLiteral('hi')),
  ]);
  const ast = b.program([unused, exported, makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 1);
  t.true(n.ExportNamedDeclaration.check(body[0]));
});

test('follows transitive dependencies', (t) => {
  // exported → middle → leaf
  const leaf = makeConst(
    'leaf',
    b.arrowFunctionExpression([], b.stringLiteral('leaf'))
  );
  const middle = makeConst(
    'middle',
    b.callExpression(b.identifier('leaf'), [])
  );
  const exported = makeExportFn('top', [
    b.returnStatement(b.callExpression(b.identifier('middle'), [])),
  ]);
  const ast = b.program([leaf, middle, exported, makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  // leaf + middle + exported — no op, no export default
  t.is(body.length, 3);
});

test('keeps imports alongside named exports', (t) => {
  const imp = makeImport('dateFns', '@openfn/language-dhis2');
  const exported = makeExportConst('formatDate');
  const ast = b.program([imp, exported, makeOp('fn')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 2);
  t.true(n.ImportDeclaration.check(body[0]));
  t.true(n.ExportNamedDeclaration.check(body[1]));
});

test('handles a file with only operations (no exports)', (t) => {
  const ast = b.program([makeOp('fn'), makeOp('get')]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 0);
});

test('handles an empty file', (t) => {
  const ast = b.program([]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 0);
});

test('handles multiple exports without operations', (t) => {
  const ast = b.program([
    makeExportConst('a'),
    makeExportConst('b'),
    makeExportFn('c'),
  ]);
  const { body } = transform(ast, [visitors], {
    'exports-only': true,
  }) as n.Program;
  t.is(body.length, 3);
});

test('does not remove export default when exports-only is disabled', (t) => {
  const ast = b.program([
    makeOp('fn'),
    b.exportDefaultDeclaration(b.arrayExpression([])),
  ]);
  const { body } = transform(ast, [visitors], {
    'exports-only': false,
  }) as n.Program;
  t.is(body.length, 2);
});
