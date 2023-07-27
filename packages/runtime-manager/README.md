## Runtime Manager

An example runtime manager service.

The runtime manager is designed as a long running node service that runs jobs as worker threads.

## Usage

To integrate the manager into your own application:

1. Create a manager:

```js
const m = Manager();
```

2. Register jobs (as DSL strings which will be compiled)

```js
m.registerJob('my_job', 'get(state.url)');
```

3. Run the job

```js
const report = await m.run('my_job');
```

The report object reports the status, duration, startTime and result of the job.

The job will soon expose an event emitter so that you can subscribe to individual events.
