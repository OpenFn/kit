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


