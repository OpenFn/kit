## Runtime Manager

An example runtime manager service.

The runtime manager is a long running node service that runs jobs as worker threads.

## Demo Server

Run `pnmpm start` to start the manager as a web service. This gives a bit of an example of how the manager might be used.

Go to `localhost:1234` to see a report on any active threads as well as the job history.

Post to `/job` to spin out a new job.

The example job is very dumb - it just waits 5 seconds then returns some randomised state.

## Worker Pooling

We using a library called Piscina to manage a pool of workers. New ones will be spun up on demand.

Note that the 'workerpool' library doesn't seem to work for us because vm.SourceTextModule is unavailable (it's like the thread loses the command argument or something?).

The flipside of this is that Piscina may expose a security risk.

Update: this may be totally untrue, I think it's an ava issue!