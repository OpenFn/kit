## Runtime Manager

An example runtime manager service.

The runtime manager is designed as a long running node service that runs jobs as worker threads.

## Demo Server

Run `pnmpm start` to start the manager as a web service. This gives a bit of an example of how the manager might be used.

Go to `localhost:1234` to see a report on any active threads as well as the job history.

Post anything to the server to run the test job. The test job will run for a random number of seconds and return a random number. Patent pending.

The server will report usage statistics when any job finishes.
~~Post to `/job` to spin out a new job.~~

## Usage

To integrate the manager into your own application:

1. Create a manager:

```js
const m = Manager();
```

2. Register jobs (as DSL strings which will be compiled)

```js
m.registerJob('my_job', 'get(state.url)')
```

3. Run the job

```js
const report = await m.run('my_job')
```
The report object reports the status, duration, startTime and result of the job.

The job will soon expose an event emitter so that you can subscribe to individual events.
