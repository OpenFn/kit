const recast = require('recast'),
  estemplate = require('estemplate'),
  fs = require('fs');

const types = require("ast-types");
const { namedTypes: n, builders: b } = types;

const { createTree } = require('@openfn/doclet-query');

function toString(ast) {
  return recast.print(ast).code;
}

/**
 * Retrieves a given modules exports given a module config
 *
 * @function
 * @param {Object} moduleConfig
 * @param {string} moduleConfig.packageName
 * @param {string} moduleConfig.memberProperty
 * @param {object} doclets - list of JSDoc tags for module
 */
function getModuleExports({ packageName, memberProperty }, doclets) {
  if (!memberProperty)
    throw new Error(
      `Inspecting JSDoc data for non-namespaced modules not supported.
       Use <languagePack>.<module> format.`)

  try {
    return createTree(doclets)[packageName].modules[memberProperty].exports
  } catch (e) {
    throw new Error(
      `Error locating exported members of ${packageName}.${memberProperty}
       Please check the JSDoc data that was provided.`)
  }
}

/**
 * Splits a language pack path into package and member parts
 *
 * @function
 * @param {string} languagePack - package/module
 */
function getModuleConfig(languagePack) {
  // We currently ignore namespaces deeper than 1. i.e. foo.bar
  const [ packageName, memberProperty ] = languagePack.split(".")
  return ({ packageName, memberProperty })
}

/**
 * Analyses and generates an executable program based on a given language pack.
 *
 * @function
 * @param {object|string} ast - Code to transform
 * @param {Object} options
 * @param {string} options.languagePack - relative package/module name
 * @param {object} options.doclets - list of JSDoc tags for languagePack 
 */
function transform(ast, { languagePack, doclets }) {

  let moduleConfig = getModuleConfig(languagePack);
  const adaptorExports = getModuleExports(moduleConfig, doclets)

  try {
    // Check if the language pack specified exists
    // TODO: referencing call expressions not available in the languagePack
    // should register errors on the AST.
    require.resolve(moduleConfig.packageName)
  } catch (e) {
    console.warn(`Warning: ${languagePack} could not be resolved.`)
  }

  if (typeof ast === 'string')
    ast = recast.parse(ast, {
      parser: {
        parse(source) {
          return require('acorn').parse(source, {
            sourceType: 'script',
            ecmaVersion: 10,
            allowHashBang: true,
            locations: true,
          });
        },
      },
    })

    // Recast with Acorn doesn't have an initial errors array.
    // if (!ast.program.errors) {
    //   ast.program.errors = [];
    // }

  // Inject all the exported members of the module into the top of the AST.
  // This is used to infer existence of a call expression for the language pack
  // using the `scope.lookup` facility.
  ast.program.body.unshift(estemplate(
    `const <%= members %> = AdaptorStub;`,
    {
      members: b.objectPattern(
        Object.keys(adaptorExports)
          .map(b.identifier)
          .map(id => b.property("init", id, id))
      )
    }).body[0])

  // =======================================================================
  // Language Call Expressions
  // =======================================================================
  //
  // We traverse the AST and collect the call expressions that *look* like
  // they belong to our language.
  //
  // * CallExpression - `operation(...args)`
  // * MemberExpression - `namespace.operation(...args)`
  //
  // TODO: Provide a more comprehensive understanding of Language Call Expressions
  // We currently do not reflect the identifiers against our language pack.
  // What this means is that we can't tell the difference between:
  // `foo.split(" ")` and `beta.each(...)`
  // This limits users freedom when using anonymous functions as arguments.

  ast.callExpressions = [];

  console.log("Analysing expression");
  // get static analysis of expression

  types.visit(ast, {
    // This method will be called for any node with .type "CallExpression":
    visitCallExpression: function(path) {
      var node = path.node;

      // If a callExpression's callee is also a callExpression
      // then we can assume state is being injected.
      // i.e. operation(...args)(state)
      if ( n.Identifier.check(node.callee) ) {
        // We only track callees with identity.
        // So skip over over outer callExpressions.
        if (path.scope.lookup(node.callee.name)) {
          ast.callExpressions.push(node);
        }
      }

      if ( n.MemberExpression.check(node.callee) && n.Identifier.check(node.callee.object) ) {
        if (path.scope.lookup(node.callee.object.name)) {
          ast.callExpressions.push(node);
        }
      }

      this.traverse(path);
    }
  });


  // Unique Expressions
  let languageCallExpressions = ast.callExpressions
    .map(c => {
      switch (c.callee.type) {
        // operation(...args)
        case 'Identifier':
          return c.callee.name

        // namespace.operation(...args)
        case 'MemberExpression':
          if (n.Identifier.check(c.callee.object)) {
            return c.callee.object.name
          }
        
        default:
          throw new TypeError(`Invalid language pack call expression: \n ${recast.print(c).code}`)
          
      }
    })
    .filter(( value,index,self ) => self.indexOf(value) === index)


  console.info(`Found ${ast.callExpressions.length} call expressions.`);
  console.info(`This expression uses the following calls:\n  ${languageCallExpressions.join(', ')}`)

  // =======================================================================
  // Execute Wrapper
  // =======================================================================

  ast.rootExpressions = []

  types.visit(ast, {
    visitCallExpression: function(path) {
      var node = path.node;

      ast.rootExpressions.push(node);

      return false;
    }
  });

  console.info(`Found ${ast.rootExpressions.length} root call expressions.`);
  console.info("Wrapping root call expressions in `execute` call.");

  console.info("Adding `execute` to language pack dependency list.")

  languageCallExpressions.push('execute')

  ast.program.body = [
    b.expressionStatement(
      b.callExpression( b.identifier('execute'), ast.rootExpressions )
    )
  ]

  // =======================================================================
  // Dependency Injector
  // =======================================================================

  console.info("Injecting language pack dependencies.")
  let expression = ast.program.body[0].expression

  let injectedCallExpression = b.callExpression(
    b.functionExpression(
      null,
      languageCallExpressions.sort().map(b.identifier),
      b.blockStatement([
        b.returnStatement( expression )
      ])
    ),
    languageCallExpressions.sort().map(name => {
      return b.memberExpression(b.identifier('languagePack'), b.identifier(name))
    })

  )

  // =======================================================================
  // Main Function
  // =======================================================================

  let executeChain = estemplate(
    `
      function main(initialState) {
        var expression = <%= expressionStatement %>;

        expression(initialState)
          .then(function(state) {
            if (finalStatePath) {
              require('fs')
              .writeFileSync(finalStatePath, JSON.stringify(state, null, 2), 'utf8');
            }
            return state;
          })
          .catch(function(e) {
            console.error(e)
            process.exitCode = 1
          });

      }
      `, {
        expressionStatement: injectedCallExpression
      }).body;


  // =======================================================================
  // CommonJS Requires
  // =======================================================================

  let moduleReferences = languagePack.split('.')
  let moduleRequires

  if (moduleReferences.length > 1) {
    moduleRequires = estemplate(
      `
      var finalStatePath = process.env.STATE_PATH;
      var languagePack = require(<%= moduleName %>)[<%= memberProperty %>]
      `,
      { 
        moduleName: b.literal(moduleReferences[0]),
        memberProperty: b.literal(moduleReferences[1])
      }
    ).body
  } else {
    moduleRequires = estemplate(
      `
      var finalStatePath = process.env.STATE_PATH;
      var languagePack = require(<%= moduleName %>)
      `,
      { moduleName: b.literal(moduleReferences[0]) }
    ).body
  }

  // =======================================================================
  // Get initial state from STDIN
  // =======================================================================

  let getInitialState = estemplate(
    `
      var stdin = process.stdin,
        stdout = process.stdout,
        data = '';

      stdin.setEncoding('binary');

      stdin.on('readable', function () {
        var chunk = stdin.read();
        if (chunk === null) {
          stdin.end();
        } else {
          data += chunk;
        }

      });

      stdin.on('end', function () {

        if (data == '') {
          throw new TypeError('No data provided.')
        }

        var initialState = JSON.parse(data) || null
        main(initialState)

      });
      `, {}
  ).body


  ast.program.body = [ ...moduleRequires, ...getInitialState, ...executeChain ];

  return ast

}

module.exports = {
  transform,
  toString
};
