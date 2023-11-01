## Lightning Mock

This package contains a mock lightning server, designed to be used with the worker and test suites.

It is currently private and only used by this monorepo.

## Getting Started

```
pnpm install
pnpm start
```

This will run on port 8888. Add `-p` to change the port.

## Architecture

This repo contains:

- A mock Pheonix websoket server implementation. Barebones but compatible with the phoenix sockets client
- A mock Lightning server which handles and acknowledges Attempt comms and an Attempts queue

The key API is in `src/api-socket/ts`. The `createSocketAPI` function hooks up websockets and binds events to event handlers. It's supposed to be quite declarative so you can track the API quite easily.

See `src/events.ts` for a typings of the expected event names, payloads and replies.

Additional dev-time API's can be found in `src/api-dev.ts`. These are for testing purposes only and not expected to be part of the Lightning platform.

## Usage

The server exposes a small dev API allowing you to post an Attempt.

You can add an attempt (`{ jobs, triggers, edges }`) to the queue with:

```
curl -X POST http://localhost:8888/attempt -d @tmp/my-attempt.json -H "Content-Type: application/json"
```

Here's an example attempt:

```
{
  "id": "my-attempt,
  "triggers": [],
  "edges": [],
  "jobs": [
    {
      "id": "job1",
      "state": { "data": { "done": true } },
      "adaptor": "@openfn/language-common@1.7.7",
      "body": "{ \"result\": 42 }"
    }
  ]
}
```
