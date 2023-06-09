# RTM Server

The RTM server provides a HTTP interface between Lightning and a runtime manager (RTM).

This package contains a mock Lightning implementation and a mock runtime manager implementation, allowing lightweight testing of the interfaces between them.

The RTM server is designed for zero persistence.

## Architecture

Lightning will push an Attempt into a queue.

The RTM server will greedily post Lightning to ask for outstanding attempts, which will returned as JSON objects to the server.

The Lightning Attempt is converted ta Runtime Execution Plan, and passed to the RTM to execute.

The server will listen to start, end, and log events in the RTM and POST them back to Lightning.

## Dev server

You can start a dev server by running:

```
pnpm start:watch
```

This will wrap a real runtime manager instance into the server. It will rebuild when the server or RTM code changes (although you'll have to `pnpm build:watch` in `runtime-manager`)

To connect to a lightning instance, pass the `-l` flag. Use `-l mock` to connect to the default mock server from this repo, or pass your own url.

The server will create a Runtime Manager instance using the repo at `OPENFN_RTM_REPO_DIR` or `/tmp/openfn/repo`.

## Lightning Mock

See `src/mock/lightning/api.ts` for an overview of the expected formal lightning API. This is the API that the RTM server will call.

Additional dev-time API's can be found in `src/mock/lightning/api-dev.ts`. These are for testing purposes only and not expected to be part of the Lightning platform.

You can start a Lightning mock server with:
```
pnpm start:lightning
```

This will run on port 8888 [TODO: drop yargs in to customise the port]

Get the Attempts queue with:
```
curl http://localhost:8888/api/1/attempts/next
```
Add an attempt (`{ jobs, triggers, edges }`) to the queue with:
```
curl -X POST http://localhost:8888/attempt -d @tmp/my-attempt.json -H "Content-Type: application/json"
```
Get an attempt with
```
curl http://localhost:8888/api/1/attempts/next/:id
```


