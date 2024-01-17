// creates a worker thread

import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads';

const scriptPath = process.argv[2];

const createThread = () => {
  const worker = new Worker(scriptPath, {
    // workerData: scriptPath,
  });

  // return an api to manipulate the thread
  worker.run = (task: string, args: []) => {
    worker.postMessage({
      type: 'engine:run_task',
      task,
      args,
    });
  };

  return worker;
};

// if (isMainThread) {
//   module.exports = function parseJSAsync(script) {
//     return new Promise((resolve, reject) => {
//       worker.on('message', resolve);
//       worker.on('error', reject);
//       worker.on('exit', (code) => {
//         if (code !== 0)
//           reject(new Error(`Worker stopped with exit code ${code}`));
//       });
//     });
//   };
// } else {
//   const { parse } = require('some-js-parsing-library');
//   const script = workerData;
//   parentPort.postMessage(parse(script));
// }

export default createThread;
