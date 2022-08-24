## Runtime

A runtime for running openfn jobs.

The runtime should be passed a list of operations, which are functions that take and return state

## Runtime Design

The runtime's job is to take a pipline of operations an execute them in series.

The runtime should:
* Accept a pipleline as stringified ESM module
* Validate the input string to ensure there's no security concerns (like blacklisted imports)
* Execute the pipeline in a safe environment with special abilities
* Return a state object
* It can also accept a pipeline as a live JS array (although I'm not sure why), but this won't be sandboxed

The runtime should not:
* Do any disk I/O 
* Compile its input (although it will validate)

Loading modules from disk should be handled by the runtime manager or wider environment (eg lightning, devtools).

The runtime is designed to be able to run in a worker thread, but it itself will not create worker threads (That's a job for the runtime environment)

## Ava and CJS

Getting tests working with @openfn/language-common 2.x has been a nightmare.

Because the build has an external set on vm (effectively excluding that module from the build file), running it from this package as an esm file will throw:

Error: Dynamic require of "vm" is not supported

This appears to be an issue in esbuild itself: https://github.com/evanw/esbuild/issues/1927

Running the same code as cjs works fine because we can dynamically require vm.

So for now, I've made this a cjs package and built to cjs in typescript. We are likely to want to address this later
