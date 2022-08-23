## Runtime

A runtime for running openfn jobs.

The runtime should be passed a list of operations, which are functions that take and return state

## Ava and CJS

Getting tests working with @openfn/language-common 2.x has been a nightmare.

Because the build has an external set on vm (effectively excluding that module from the build file), running it from this package as an esm file will throw:

Error: Dynamic require of "vm" is not supported

This appears to be an issue in esbuild itself: https://github.com/evanw/esbuild/issues/1927

Running the same code as cjs works fine because we can dynamically require vm.

So for now, I've made this a cjs package and built to cjs in typescript. We are likely to want to address this later
