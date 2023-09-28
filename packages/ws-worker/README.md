# Websocket Worker

The Websocket Worker `ws-worker` provides a Websocket interface between Lightning and a Runtime Engine.

It is a fairly thin layer between the two systems, designed to transport messages and convert Lightning data structres into runtime-friendly ones.

This package contains:

- A mock Lightning implementation
- A mock runtime engine implementation
- A mock server for phoenix websockets (allowing the phx Socket client to connect and exchange messages)
- A server which connects Lightning to an Engine (exposing dev APIs to http and node.js)

The mock services allow lightweight and controlled testing of the interfaces between them.

## Architecture

Lightning is expected to maintain a queue of attempts. The Worker pulls those attempts from the queue, via websocket, and sends them off to the Engine for execution.

While the engine executes it may need to request more information (like credentials and dataclips) and may feedback status (such as logging and runs). The Worker satisifies both these requirements.

The RTM server is designed for zero persistence. It does not have any database, does not use the file system. Should the server crash, tracking of any active jobs will be lost (Lightning is expected to time these runs out).

## Dev server

You can start a dev server by running:

```
pnpm start:watch
```

This will wrap a real runtime engine into the server (?). It will rebuild when the Worker Engine code changes (although you'll have to `pnpm build:watch` in `runtime-manager`). This will use the repo at `OPENFN_RTE_REPO_DIR` or `/tmp/openfn/repo`.

To connect to a lightning instance, pass the `-l` flag. Use `-l mock` to connect to the default mock server from this repo, or pass your own url.

## Lightning Mock

The key API is in `src/mock/lightning/api-socket/ts`. The `createSocketAPI` function hooks up websockets and binds events to event handlers. It's supposed to be quite declarative so you can track the API quite easily.

See `src/events.ts` for a typings of the expected event names, payloads and replies.

Additional dev-time API's can be found in `src/mock/lightning/api-dev.ts`. These are for testing purposes only and not expected to be part of the Lightning platform.

You can start a Lightning mock server with:

```s
pnpm start:lightning
```

This will run on port 8888 [TODO: drop yargs in to customise the port]

You can add an attempt (`{ jobs, triggers, edges }`) to the queue with:

```
curl -X POST http://localhost:8888/attempt -d @tmp/my-attempt.json -H "Content-Type: application/json"
```