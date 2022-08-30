const types = require('ast-types');
const estemplate = require('estemplate');
const { namedTypes: n, builders: b } = types;

// column : 26
// description : "Strict mode code may not include a with statement"
// index : 171
// lineNumber : 14

function CompilationError({ node, description }) {
  this.node = node;
  this.name = 'CompilationError';
  this.message = description;
}
CompilationError.prototype = Object.create(Error.prototype);
CompilationError.prototype.constructor = CompilationError;

// Using a sandbox, verify injects that into the top of the AST.
// This enables it to do checks for call expressions, this allows a fair
// degree of certainty the expression will be able to run.
//
// For example: `foo(); bar()`, with a sandbox of { foo: ..., bar: ... }
// will be successful, however if the sandbox does not contain any number of
// functions these will be added to the errors list.
function verify(opts) {
  if (!opts.sandbox) {
    throw new Error('verify requires a `sandbox` option.');
  }
  return ast => {
    // Inject all the exported members of the module into the top of the AST.
    // This is used to infer existence of a call expression for the language pack
    // using the `scope.lookup` facility.
    ast.program.body.unshift(
      estemplate(`const <%= members %> = AdaptorStub;`, {
        members: b.objectPattern(
          Object.keys(opts.sandbox)
            .map(b.identifier)
            .map(id => b.property('init', id, id))
        ),
      }).body[0]
    );

    types.visit(ast, {
      // This method will be called for any node with .type "CallExpression":
      visitCallExpression: function (path) {
        var node = path.node;

        // If a callExpression's callee is also a callExpression
        // then we can assume state is being injected.
        // i.e. operation(...args)(state)
        if (n.Identifier.check(node.callee)) {
          // We only track callees with identity.
          // So skip over over outer callExpressions.

          if (path.scope.lookup(node.callee.name)) {
            // ast.callExpressions.push(node);
          } else {
            ast.program.errors.push(
              new CompilationError({
                node,
                description: 'Function not available.',
              })
            );
          }
        }

        if (
          n.MemberExpression.check(node.callee) &&
          n.Identifier.check(node.callee.object)
        ) {
          if (path.scope.lookup(node.callee.object.name)) {
            // ast.callExpressions.push(node);
          } else {
            ast.program.errors.push(
              new CompilationError({
                node,
                description: 'Function not available.',
              })
            );
          }
        }

        this.traverse(path);
      },
    });

    // Remove the sandbox injection.
    ast.program.body.shift();

    return ast;
  };
}

// Takes all the callExpressions found on the root, and wraps them in another
// call expression with a given name:
//
// Example:
// `foo(); bar();` => wrapRootExpressions('execute') => `execute(foo(), bar())`
function wrapRootExpressions(ident) {
  return ast => {
    ast.rootExpressions = [];

    types.visit(ast, {
      visitCallExpression: function (path) {
        var node = path.node;

        ast.rootExpressions.push(node);

        return false;
      },
    });

    ast.program.body = [
      b.expressionStatement(
        b.callExpression(b.identifier(ident), ast.rootExpressions)
      ),
    ];

    return ast;
  };
}

// Given a call expression identifier name, and an external identifier name
// it wraps a callExpression in another callExpression calling it with the
// identifier name given.
//
// Example: `foo(1,2,3)` => callFunction('foo', 'bar') => `foo(1,2,3)(bar)`
function callFunction(call, ident) {
  return ast => {
    types.visit(ast, {
      visitCallExpression: function (path) {
        var node = path.node;

        // If a callExpression's callee is also a callExpression
        // then we can assume state is being injected.
        // i.e. operation(...args)(state)
        if (n.Identifier.check(node.callee) && node.callee.name == call) {
          path.replace(b.callExpression(node, [b.identifier(ident)]));
        }

        return false;
      },
    });

    return ast;
  };
}

// Wraps the first expression on the program in an IIFE.
//
// Example: `foo()` => wrapIIFE() => `(function() { return foo(); })()`
function wrapIIFE() {
  return ast => {
    ast.program.body = [
      b.expressionStatement(
        b.callExpression(
          b.functionExpression(
            null,
            [],
            b.blockStatement([
              b.returnStatement(ast.program.body[0].expression),
            ])
          ),
          []
        )
      ),
    ];
    return ast;
  };
}

const defaultTransforms = [
  wrapRootExpressions('execute'),
  callFunction('execute', 'state'),
  wrapIIFE(),
];

module.exports = {
  verify,
  wrapRootExpressions,
  callFunction,
  wrapIIFE,
  defaultTransforms,
};
