import child_process from 'node:child_process';

// make the API look like workerpool
// (it's just an easier integration for how)
const api = {
  // mimic the handshake task
  // (basically we'll just return true)
  _handshake: () => {},

  _run: async (plan: any, options: any) => {
    return runInChildProcess(plan, options);
  },

  exec: (task: string, args: any[]) => {
    if (task === 'run') {
      return api._run(...args);
    }
  },
};

function runInChildProcess(plan: any, options: any) {
  console.log('*', process.pid);
  return new Promise((resolve, reject) => {
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
      console.log(e);
      if (e.type === 'worker:workflow-complete') {
        console.log('heard workflow complete!');
        const state = e.state;

        p.disconnect();

        resolve(state);
      }

      // TODO kill the process now
    });
  });
}

export default api;
