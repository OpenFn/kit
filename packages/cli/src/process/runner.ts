import parse, { Opts } from '../commands';

type InitMessage = {
  init: true;
  basePath: string;
  opts: Opts;
  //command?: string; // TODO execute | compile | validate etc
};

// When receiving a message as a child process, we pull out the args and run
process.on('message', ({ init, basePath, opts }: InitMessage) => {
  if (init) {
    parse(basePath, opts).then(() => {
      process.send!({ done: true });
    });
  }
});
