## Multi-process engine

A runtime engine which runs multiple jobs in worker threads.

A long-running node service, suitable for integration with a Worker, for executing workflows.

## Usage

The Engine runs Workflows or Execution Plans. A plan MUST have an id.

Note: An Execution Plan is NOT the same as a Lightning attempt, although there is a 1:1 mapping between them.

Instantiate a new Engine:

```
import createEngine from '@openfn/engine-multi';
import createLogger from '@openfn/logger';

const engine = await createEngine({
  repoDir: '/tmp/openfn/engine-repo', // this is where modules are autoinstalled to
  logger: createLogger('ENGINE', { level: 'debug' }) // control log output
})
```

The createEngine function is asynchronous. It will validate that it is connected to a valid dedicated worker file before reporting for duty. The packaged Engine should do this automatically, but it does require an await.

Execute a job:

```
engine.execute(plan)
```

`execute` returns an event emitter which you can listen to:

```
engine.execute(plan).on('workflow-complete', (event) => {
  const { state, duration } = event;
  console.log(`Workflow finsihed in ${duration}`ms)
})
```

You can also call the `listen` API to listen to events from a particular workflow. Listen needs a workflow id and an object of events with callbacks:

```
engine.listen(plan.id, {
  'workflow-complete', (event) => {
    const { state, duration } = event;
    console.log(`Workflow finsihed in ${duration}`ms)
  }
});
engine.execute(plan)
```

For a full list of events, see `src/events/ts` (the top-level API events are listed at the top)

## Module Loader Whitelist

A whitelist controls what modules a job is allowed to import. At the moment this is hardcoded in the Engine to modules starting with @openfn.

This means jobs cannot do `import _ from 'lodash'`.

## Adaptor Installation

The engine has an auto-install feature. This will ensure that all required adaptors for a workflow are installed in the local repo before execution begins.

Blacklisted modules are not installed.

You can pass a path to local repo dir through the `repoDir` argument in `createEngine`. If no path is provided, it will use a default value (see the logs).

## Resolving Execution Plans

An ExecutionPlan supports lazy-loading of state objects and configuration credentials. If either of these values appears as a string, the Engine will try to resolve them to object values.

The Engine cannot do this itself: you must pass a set of resolve functions. These can do whatever you like (a typical use-case is to call up to Lightning). Pass resolvers to the execute call:

```
const resolvers = {
  credential: (id: string) => lightning.loadCredential(id),
  dataclip: (id: string) => lightning.loadState(id),
};
engine.execute(plan, { resolvers });
```

Initial state and credentials are at the moment pre-loaded, with a "fully resolved" state object passed into the runtime. The Runtime has the ability to lazy load but implementing lazy loading across the worker_thread interface has proven tricky.

## Architecture

The Engine uses a dedicated worker found in src/worker/worker.ts. Most of the actual logic is in worker-helper.ts, and is shared by both the real worker (which calls out to @openfn/runtime), and the mock worker (which simulates and evals a run). The mock worker is mostly used in unit tests.

The main interface to the engine, API, exposes a very limited and controlled interface to consumers. api.ts provides the main export and is a thin API wrapper around the main implementation, providing defauls and validation.

The main implementation is in engine.ts, which exposes a much broader interface, with more options. This is potentially dangerous to consumers, but is extremely useful for unit testing here. For example, the dedicated worker path can be set here, as can the whitelist.

When execute is called and passed a plan, the engine first generates an execution context. This contains an event emitter just for that workflower and some contextualised state.

## Security Considerations & Memory Management

The engine uses workerpool to maintain a pool of worker threads.

As workflows come in to be executed, they are passed to workerpool which will pick an idle worker and execute the workflow within it.

workerpool has no natural environment hardening, which means workflows running in the same thread will share an environment. Globals set in workflow A will be available to workflow B, and by the same token an adaptor loaded for workflow A will be shared with workflow B.

Also, because the thread is long-lived, modules imported into the sandbox will be shared.

We have several mitgations against this, ensuring a safe, secure and stable execution environment:

- The runtime sandbox itself ensures that each job runs in an isolated context. If a job escapes the sandbox, it will have access to the thread's global scope
- Each workflow appends a unique id to all its imports, busting the node cache and forcing each module to be re-initialised. This means workers cannot share adaptors and all state is reset.

Inside the worker thread, we ensure that:

- The parent `process.env` is not visible (by default in workerpool the woker will "inherit" the parent env)
- The parent process is not accessible (check this)
- The parent scope is not visible (this is innate in workerpool design).

After initialisation, the only way that the parent process and child thread can communicate is a) through the sendMessage() interface (which really means the child can only send messages that the parent is expecting), b) through a shared memory buffer (usage of which is limited and controlled by the parent), and c) returning a value from a function execution.
