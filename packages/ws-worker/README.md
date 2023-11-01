# Websocket Worker

The Websocket Worker `ws-worker` provides a Websocket interface between Lightning and a Runtime Engine.

It is a fairly thin layer between the two systems, designed to transport messages and convert Lightning data structures into runtime-friendly ones.

This package contains:

- A server which connects Lightning to an Engine (exposing dev APIs to http and node.js)
- A mock runtime engine implementation

The mock services allow lightweight and controlled testing of the interfaces between them.

## Getting started

To use this server:

- Start a lightning instance (you can use the mock if you like, see `../lightning-mock`)
- Start the worker server with `pnpm start`

The worker will use the WORKER_SECRET env var (which you should have set for Lightning already). Check WORKERS.md in Lightning and run this in Lightning if you haven't already:

```
mix lightning.gen_worker_keys
```

### WS Server

To start a `ws-worker` server, run:

```
pnpm start
```

You may want to add `--log debug` or disable the work loop, see below.

The default settings will try and connect to lightning at `localhost:4000`.

Pass a custom lightining url with `-l ws://localhost:1234`. You need to include the websocket endpoint, which at the time of writing is `/worker`.

Use `-l mock` to connect to a lightning mock server (on the default port).

## Watched Server

You can start a dev server (which rebuilds on save) by running:

```
pnpm start:watch
```

This will wrap a real runtime engine into the server (?). It will rebuild when the Worker Engine code changes (although you'll have to `pnpm build:watch` in `runtime-manager`). This will use the repo at `ENGINE_REPO_DIR` or `/tmp/openfn/repo`.

### Disabling auto-fetch

When working in dev it is convinient to disable the workloop. To switch it off, run:

```
pnpm start --no-loop
```

To manually trigger a claim, post to `/claim`:

```
curl -X POST http://localhost:2222/claim
```

## Architecture

Lightning is expected to maintain a queue of attempts. The Worker pulls those attempts from the queue, via websocket, and sends them off to the Engine for execution.

While the engine executes it may need to request more information (like credentials and dataclips) and may feedback status (such as logging and runs). The Worker satisifies both these requirements.

The ws-worker server is designed for zero persistence. It does not have any database, does not use the file system. Should the server crash, tracking of any active jobs will be lost (Lightning is expected to time these runs out).
