## @openfn/compiler

Functions and utilities to compile and analyse code.

The primary job of the compiler right now is to take job DSL code and convert it into JS which can be executed by the runtime.

## Expected functionality

- Build an AST for some JS (and openfn JS DSL)
- Transpile a JS-DSL into job-compatible JS
- Report errors and warnings on job/js code (custom linting stuff)
- (maybe) Generate a form UI tree and convert a form UI tree back to JS

## CLI Parser

A simple CLI parser utility is provided.

You can pass a string of Javascript and it will output an AST tree to stdout.

Pass -s for a simplified tree (way easier to read!), -o path/to/output.json, -e to eval the input (otherwise it'll be treated as a path)

`$ pnpm parse -s -e "fn();"`

If writing tests against ast trees, you can pass the -t flag with a test name. The resulting tree will be output to `test/asts/{name}.json` without prettification.

`$ pnpm parse -t "my-test" /tmp/my-test.js`

## Documentation

TODO

# Node types reference

It can be pretty hard to understand what the parse trees look like.

The basic spec is here: [https://github.com/estree/estree/blob/master/es2015.md](https://github.com/estree/estree/blob/master/es2015.md)

You have to check the parent folder for later language extensions.

## Inserting imports

The compiler can inject imports for a specific adaptor.

This requires the exports for the adaptor to be pre-loaded and appended to the options object. This is because the AST walked is synchronous, but fetching type definitions is an asynchronous task. [more details to follow]

There is a helper function `preloadAdaptorExports` in `src/util` to do this.
