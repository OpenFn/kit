# Websocket Worker

The Websocket Worker `ws-worker` provides a Websocket interface between Lightning and a Runtime Engine.

It is a fairly thin layer between the two systems, designed to transport messages and convert Lightning data structures into runtime-friendly ones.

This package contains:

- A server which connects Lightning to an Engine (exposing dev APIs to http and node.js)
- A mock runtime engine implementation

The mock services allow lightweight and controlled testing of the interfaces between them.

## Docker

To build and run the worker as a Docker image locally:

```bash
docker build -t openfn-worker .
docker run --network host -e WORKER_SECRET=$WORKER_SECRET -e WORKER_LIGHTNING_SERVICE_URL="ws://localhost:4000/worker"  openfn-worker
```

## Getting started

To use this server:

- Start a lightning instance (you can use the mock if you like, see `../lightning-mock`)
- Start the worker server with `pnpm start`

The worker will use the WORKER_SECRET env var (which you should have set for Lightning already). Check WORKERS.md in Lightning and run this in Lightning if you haven't already:

```
mix lightning.gen_worker_keys
```

To start a `ws-worker` server, run:

```
pnpm start
```

You may want to add `--log debug` or disable the work loop, see below.

The default settings will try and connect to lightning at `localhost:4000`.

Pass a custom lightining url with `-l ws://localhost:1234/worker`. (Note that you need to include the websocket endpoint, which at the time of writing is `/worker`.)

Use `-l mock` to connect to a lightning mock server (on the default port).

## Options

For a list of supported worker and engine options, see src/start.ts

## Watched Server

You can start a dev server (which rebuilds on save) by running:

```
pnpm start:watch
```

This will wrap a real runtime engine into the server. It will rebuild when the Worker Engine code changes (although you'll have to `pnpm build:watch` in `runtime-manager`). This will use the repo at `WORKER_REPO_DIR` (or a default path in /tmp)

### Disabling auto-fetch

When working in dev it is convenient to disable the workloop. To switch it off, run:

```
pnpm start --no-loop
```

To manually trigger a claim, post to `/claim`:

```
curl -X POST http://localhost:2222/claim
```

## Collections

To enable collections with a local lightning:

```
pnpm start -collections-url http://localhost:4000/collections
```

To use the monorepo adaptor version:

```
pnpm start --collections-version local --collections-url http://localhost:4000/collections
```

## Workloops

By default, the worker runs a single workloop that claims runs from any
queue, preferring the `manual` queue (used for manually-triggered and
webhook runs). This is equivalent to `--workloops "manual>*:5"`.

The `--workloops` option lets you split the worker's capacity into
independent groups, each with its own queue preference chain and slot
count. This is useful for dedicating capacity to latency-sensitive
workloads (e.g., sync webhooks on a `fast_lane` queue) while letting
remaining capacity serve general work.

```
--workloops "<queues>:<capacity> <queues>:<capacity> ..."
```

### Syntax

| Element     | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| `>`         | Queue preference separator (left = highest priority) |
| `*`         | Wildcard: accept runs from any queue (must be last)  |
| `:N`        | Number of slots for this group                       |
| ` ` (space) | Group separator                                      |

### Examples

```bash
# 1 slot pinned to fast_lane (strict), 4 slots preferring manual then anything
--workloops "fast_lane:1 manual>*:4"

# 5 generic slots (pure FIFO across all queues) — equivalent to --capacity 5
--workloops "*:5"

# 2 fast lane (strict), 3 with manual preference
--workloops "fast_lane:2 manual>*:3"

# 1 slot preferring fast_lane > manual > rest, 4 generic
--workloops "fast_lane>manual>*:1 *:4"
```

A group **without** `*` in its queue list is strict — it will only
claim runs from the named queues. A group **with** `*` will accept any
run, but prefers queues listed before the wildcard.

### Environment variable

```
WORKER_WORKLOOPS="fast_lane:1 manual>*:4"
```

### Relationship to --capacity

`--workloops` and `--capacity` are mutually exclusive. If neither is
provided, the default is `--capacity 5`, which internally creates a
single `manual>*:5` group. The total capacity of the worker is always
the sum of all group slot counts.

### How it works

Each group runs its own independent claim loop with its own backoff
timer. When a run completes, only the owning group's workloop resumes.
A `work-available` push from Lightning triggers a claim attempt on
every group that has free slots.

```
  Main Process (ws-worker)
 ├── Workloop 1 (manual>*:2)  ─┐
 ├── Workloop 2 (fast_lane:1) ─┼── all run in the main process as async loops
 ├── Workloop 3 (*:5)         ─┘
 │
 └── Engine (single instance, shared by all lanes)
     └── Child Process Pool (capacity = sum of all lanes/slots)
         ├── Child 1 (forked) → Worker Thread (per task)
         ├── Child 2 (forked) → Worker Thread (per task)
         ├── ...on demand, reused after each task
         └── Child N
```

## Architecture

Lightning is expected to maintain a queue of runs. The Worker pulls those runs from the queue, via websocket, and sends them off to the Engine for execution.

While the engine executes it may need to request more information (like credentials and dataclips) and may feedback status (such as logging and runs). The Worker satisifies both these requirements.

The ws-worker server is designed for zero persistence. It does not have any database, does not use the file system. Should the server crash, tracking of any active jobs will be lost (Lightning is expected to time these runs out).
