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

You can start a dev server by running

```
pnpm start:watch
```

This will wrap a real runtime manager instance into the server. It will rebuild when the server or RTM code changes.

By default this does not connect to a lightning instance. [TODO need to enable this to talk to the default lightning mock server if it's enabled]

## Lightning Mock

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


