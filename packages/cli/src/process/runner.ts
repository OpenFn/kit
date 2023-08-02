import parse from '../commands';
import type { Opts } from '../options';

type InitMessage = {
  init: true;
  opts: Opts;
};

// When receiving a message as a child process, we pull out the args and run
process.on('message', ({ init, opts }: InitMessage) => {
  if (init) {
    parse(opts).then(() => {
      process.send!({ done: true, exitCode: process.exitCode });
    });
  }
});

// Tell the parent process we're awake and ready
process.send!({
  init: true,
});
