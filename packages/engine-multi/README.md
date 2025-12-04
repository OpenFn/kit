## Multi-process engine

A runtime engine which runs multiple jobs in worker threads.

A long-running node service, suitable for integration with a Worker, for executing workflows.

# Architecture

The engine runs in the main process and exposes an `execute` function, which can be called by some wrapping service (ie, the Lightning Worker).

The engine maintains a pool of long-lived child processes. For every `execute` call, the engine will pick an idle child process from the pool and execute the workflow within it.

Inside the child process, we actually execute the runtime inside a worker thread. Each child process has exactly one worker, which is created on demand and destroyed on completion.

So the process tree looks a bit like this:

```
-- main thread (execute, compile, autoinstall)
 -- child_process (spawn worker)
  -- worker_thread (@openfn/runtime)
```

Pooled child-processes are lazily spawned. If a worker never needs to run more than one task concurrently, it will only have one child process.

![architecture diagram](docs/architecture.png)

This architecture has several benefits:

- Each run executes in a clean sandbox inside a worker_thread /inside/ a child process. A double-buffered sandbox.
- The child process can always control the thread, even if the thread locks the CPU, to shut it down
- If the worker thread blows its memory limit, other runs will be unaffected as they are in different child processes

At the time of writing, compilation and autoinstall are run on the main thread - not in the child process.

## Usage

The Engine runs Workflows or Execution Plans. A plan MUST have an id.

Note: An Execution Plan is NOT the same as a Lightning run, although there is a 1:1 mapping between them.

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

## Note on Debugging

Debugging in the engine can be really tricky.

First there's the problem that a lot of code runs inside a worker thread in a child process, which is hard to get a breakpoint into (at the time of writing I haven't managed to do it).

But also, any console.log statements inside the inner thread will get consumed by the adaptor logger and won't go to stdout.

As a workaround to this, use console.debug inside the thread to print to stdout. This is not bound to the adaptor logger.

## Payload perf

Testing payload sizes

```bash
/usr/bin/time -v pnpm tsx test/payload.ts
```

Just loading the JSON:

Maximum resident set size (kbytes): 117076 117mb

This has a 10mb variance over several runs. Call it 115mb.

If I call verify to stringify:

I would say it creeps up a little bit to mostly over 120mb.

Oh interesting: console.log(data.length) itself takes quite a bit of memory

As soon as data is referenced the memory goes up. Probably the import is optimised out.

yes: it's about 98mb without the import, and 115mb if I import and reference

Ok, final swing, just as a rough guide, I want to plug this in to AI

It's generated a very good looking traversal algorithm to calculate the size.

But this seems to take more memory! 125mb+! Saw it go over 30 once

Worth adding: if I reduce the limit to 1mb, and so the traversal gets the chance to exit early, it uses ~122mb. About the same as stringify.

The larger the object, the bigger the saving. but also for small objects you are adding overhead.

But the AI has another idea: drop recursion and use a queue to process items. Shallower call stack. Let's go

10mb limit traverse: 115-120

1mb limit traverse: same really

10mb stringify: 117-125 (mostly over 120)

Now we're getting somewhere
