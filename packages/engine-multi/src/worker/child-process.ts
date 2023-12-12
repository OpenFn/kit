import child_process from 'node:child_process';

import EventEmitter from 'node:events';

// make the API look like workerpool
// (it's just an easier integration for how)
const api = {
  // mimic the handshake task
  // (basically we'll just return true)
  _handshake: () => {},

  _run: (plan: any, options: any) => runInChildProcess(plan, options),

  exec: (task: string, args: any[]) => {
    if (task === 'run') {
      return api._run(...args);
    }
  },
};

function runInChildProcess(plan: any, options: any) {
  console.log('*', process.pid);

  const events = new EventEmitter();

  const p = new Promise((resolve, reject) => {
    console.log('starting child process....');
    const p = child_process.fork(
      './dist/worker/child_worker.js',
      [JSON.stringify(plan), JSON.stringify(options)],
      {
        detached: true, // child will live if parent dies.
        // although tbf, what's the point?
      }
    );

    p.on('message', (e) => {
      const { type, ...payload } = e;
      // console.log(' > emitting ', type);
      events.emit(type, payload);

      // console.log(e);
      if (type === 'worker:workflow-complete') {
        // console.log('heard workflow complete!');
        const state = e.state;

        resolve(state);

        setTimeout(() => {
          p.disconnect();
        }, 1);
      }

      // TODO kill the process now
    });
  });

  p.on = (...args) => events.on(...args);

  return p;
}

export default api;
