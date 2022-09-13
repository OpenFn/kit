## @openfn/cli (devtools)

This package contains a new devtools cli.

Devtools will:
* Compile a job expression into an executable module
* Pass the compiled module into the runtime
* Write or print the resulting state.

The CLI only has one command right now. Give it a path and it will:
* If the path ends in .js, it will be loaded as a job file and executed. State and output will be read/written relative to it.
* If the path is a folder, the CLI will look for a job.js, state.json and write an output.json.

You can override specific paths.

Run `pnmp -h` to print usage help (the best source of truth right now).

## Example future usage

```
$ npm install -g @openfn/cli`
$ openfn execute expression.js`
$ openfn execute tmp`
```

## Eventual API sketch

I envisage the CLI either being installed globally (useful if you're writing an adaptor) or straight out of kit (useful if you're writing core stuff).

```
$ openfn execute expression.js \
  --state="path/to/initial-state.json" \
  --output="path/to/output.json" \
  --expression="path/to/expression.js" \
  --no-compile (won't compile expresson.js)
  --no-validate (don't validate the input)
  --stdout (output to stdout)
  --log level (set the logging level)
  --adapter=@openfn/language-common:path/to/language-common
```
```
$ openfn compile
```
```
$ openfn validate
```

## Module Resolution

Any import statements inside a job have to resolve to a node module. This either means the module is resolved:

* Relative to the env var OPENFN_MODULE_HOME
* Relative to CLI's node_modules
* Relative to global node_modules

Basically, to work with adaptors, you should:

* Save your adaptors globally

Or

* Save adaptors to a folder somewhere (~/openfn) and set OPENFN_MODULE_HOME=~/openfn

## TODO experimental args difficulty

When we call the CLI `node cli.js` or whatever, we need to pass in experimental module flags for it to work. This is annoying. Should the cli spin up a new process with the right args?

Update: We now also need to pass --experimental-specifier-resolution=node to handle dynamic imports.