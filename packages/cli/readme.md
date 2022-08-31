## @openfn/cli (devtools)

This package contains a new devtools cli

Devtools will:
* Compile a job expression into an executable module
* Pass the compiled module into the runtime
* Write the resulting state to /tmp

State and output will be read/written from/to /tmp/[expression]. You can set this folder to whatever you like with the --dir argument.

If you do `devtools somefolder` it will read expression, state and write output form/to that folder

## Example usage

`npm install -i @openfn/cli`

`openfn expression.js`

`openfn tmp`

## API sketch

openfn expression.js \
  --state="path/to/initial-state.json" \
  --output="path/to/output.json" \
  --expression="path/to/expression.js" \
  --no-compile (won't compile expresson.js)
  --no-validate (don't validate the input)
  --stdout (output to stdout)
  --log level (set the logging level)
  --adapter=@openfn/language-common:path/to/language-common