// this runs inside the worker pool
// everychild process runs this script
// all it really does is spawn out a worker thread
// and proxy messages

// we should be able to test this in isolation.

// then the pool needs to be updated to run this guy in each child process
// and forward the args through

// return an event emitter so we can send() and on()
export const run = () => {};
