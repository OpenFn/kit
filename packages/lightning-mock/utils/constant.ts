import createLightningServer from '../src/server';

// start a lightning mock

const port = 8888;
const server = createLightningServer({
  port,
  runPrivateKey: process.env.WORKER_RUNS_PRIVATE_KEY,
});
let idgen = 1;

// create work every second

const sleep = (duration = 100) =>
  new Promise((resolve) => setTimeout(resolve, duration));

let count = 0;
const max = 2;

// while (true) {
while (count++ < 10) {
  console.log(' > posting');
  fetch(`http://localhost:${port}/run`, {
    method: 'POST',
    body: JSON.stringify(wf()),
    headers: {
      'content-type': 'application/json',
    },
  });
  // await sleep(5 * 1000);
  await sleep(100);
}

// setTimeout(() => {
//   fetch(`http://localhost:${port}/run`, {
//     method: 'POST',
//     body: JSON.stringify(wf()),
//     headers: {
//       'content-type': 'application/json',
//     },
//   });
// }, 5000);

function wf() {
  const step = `
    fn((state) => {
        state.data = []
        let counter = 1e4;
        while(--counter) {
          const str = new Array(1e3).fill(1).join('')
          state.data.push(str)
        }
        state.data = state.data.join()
        console.log(state.data.length)
        return state;
    })
  `;

  return {
    id: `run-${idgen++}`,
    triggers: [],
    edges: [],
    jobs: [
      {
        id: 'a',
        adaptor: '@openfn/language-common@3.0.3',
        body: step,
      },
    ],
  };
}
