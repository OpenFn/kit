## Multi-process engine

A runtime engine which runs multiple jobs in worker threads.

A long-running node service, suitable for integration with a Worker, for executing workflows.

Docs to follow

## Usage

TODO (describe execute, listen and execute.on)

## Getting Started

TODO (overview for devs using this repo)

## Adaptor Installation

The engine has an auto-install feature. This will ensure that all required adaptors for a workflow are installed in the local repo before execution begins.

## Architecture

The main interface to the engine, API, exposes a very limited and controlled interface to consumers. api.ts provides the main export and is a thin API wrapper around the main implementation.

The main implementation is in engine.ts, which exposes a much broader interface, with more options. This is potentially dangerous to consumers, but is extremely useful for unit testing here.

When execute is called and passed a plan, the engine first generates an execution context. This contains an event emitter just for that workflower and some contextualised state.

Initial state and credentials are at the moment pre-loaded, with a "fully resolved" state object passed into the runtime. The Runtime has the ability to lazy load but implementing lazy loading across the worker_thread interface has proven tricky.

## Security Considerations

The engine uses workerpool to maintain a pool of worker threads.

As workflows come in to be executed, they are passed to workerpool which will pick an idle worker and execute the workflow within it.

workerpool has no natural environment hardening, which means workflows running in the same thread will share an environment. Globals set in workflow A will be available to workflow B, and by the same token an adaptor loaded for workflow A will be shared with workflow B.

We have two mitigations to this:

- The runtime sandbox itself ensures that each job runs in an isolated context. If a job escapes the sandbox, it will have access to the thread's global scope
- Inside the worker thread, we freeze the global scope. This basically means that jobs are unable to write data to the global scope.

Inside the worker thread, we ensure that:

- The parent `process.env` is not visible (by default in workerpool the woker will "inherit" the parent env)
- The parent process is not accessible (check this)
- The parent scope is not visible (this is innate in workerpool design).

After initialisation, the only way that the parent process and child thread can communicate is a) through the sendMessage() interface (which really means the child can only send messages that the parent is expecting), b) through a shared memory buffer (usage of which is limited and controlled by the parent), and c) returning a value from a function execution.
