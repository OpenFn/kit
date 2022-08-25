## Runtime

A runtime for running openfn jobs.

The runtime should be passed a list of operations, which are functions that take and return state

## Basic Usage

The runtime should be passed the source for a single job (as a string, as a module which exports an array of functions.)

```
import { readFile } from 'node:fs/promises';
import run from '@openfn/runtime';

const job = await readFile('expression.js', 'utf8');
const initialState = {};
const { data } = await run(source, initialState);
```

See test/examples for more useage.

## Runtime Design

The runtime's job is to take a pipline of operations an execute them in series.

The runtime should:
* Accept a pipleline as stringified ESM module
* Validate the input string to ensure there's no security concerns (like blacklisted imports)
* Execute the pipeline in a safe environment (with some utilities and overiddes provided)
* Ensure that the state object is not mutated between jobs
* Return a state object
* It can also accept a pipeline as a live JS array (although I'm not sure why), but this won't be sandboxed

The runtime should not:
* Do any disk I/O 
* Compile its input jobs (although it will validate using the compiler)

Loading modules from disk should be handled by the runtime manager or wider environment (eg lightning, devtools).

The runtime is designed to be able to run in a worker thread, but it itself will not create worker threads (That's a job for the runtime environment)
