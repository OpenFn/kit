import child_process from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EventEmitter from 'node:events';

// make the API look like workerpool
// (it's just an easier integration for how)
const api = {
  // mimic the handshake task
  // (basically we'll just return true)
  _handshake: () => {},

  _run: (plan: any, options: any, events: any) =>
    runInChildProcess(plan, options, events),

  exec: (task: string, args: any[], events: any) => {
    if (task === 'run') {
      const [plan, options] = args;
      return api._run(plan, options, events);
    }
  },
};

function runInChildProcess(plan: any, options: any, events: any = {}) {
  // console.log('*', process.pid);

  // const events = new EventEmitter();

  const p = new Promise((resolve, reject) => {
    // console.log('starting child process....');

    let dirname = path.dirname(fileURLToPath(import.meta.url));

    // // nasty hack to sort out pathing
    if (dirname.endsWith('/dist')) {
      dirname += '/worker';
    }
    // console.log(' >> ', dirname);
    const p = child_process.fork(
      // TODO I dont think this path is right
      path.resolve(dirname, '../../dist/worker/child_worker.js'),
      [JSON.stringify(plan), JSON.stringify(options)],
      {
        execArgv: ['--experimental-vm-modules', '--no-warnings'],
        detached: true, // child will live if parent dies.
        // although tbf, what's the point?
      }
    );

    p.on('message', (e) => {
      const { type, ...payload } = e;
      // console.log(' > emitting ', type);
      events.on?.(e);

      // console.log(e);
      if (type === 'worker:workflow-complete') {
        // console.log('heard workflow complete!');
        const state = e.state;

        resolve(state);

        // setTimeout(() => {
        //   p.disconnect();
        // }, 1);
      }

      // TODO kill the process now
    });
  });

  // p.on = (...args) => events.on(...args);

  return p;
}

export default api;
