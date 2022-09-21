import { execute, compile, Opts } from '../commands';

type Args = {
  command?: string; // TODO execute | compile | validate etc
  basePath: string;
  opts: Opts;
}

// When receiving a message as a child process, we pull out the args and run
process.on('message', ({ basePath, opts }: Args) => {
  if (basePath && typeof basePath === 'string') {
    if (opts.compileOnly) {
      compile(basePath, opts).then(() => {
        process.send!({ done: true });
      });
    } else {
      execute(basePath, opts).then(() => {
        process.send!({ done: true });
      });
    }
  }
});
