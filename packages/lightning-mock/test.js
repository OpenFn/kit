let id = 0;

const wf = {
  id: 'my-attempt',
  triggers: [],
  edges: [],
  jobs: [
    {
      id: 'job1',
      adaptor: '@openfn/language-common@1.7.7',
      body: 'fn(() => new Promise((resolve) => setTimeout(resolve, 5000)) )',
    },
  ],
};

// setInterval(() => {
fetch('http://localhost:8888/run', {
  method: 'POST',
  body: JSON.stringify({
    ...wf,
    id: `${++id}`,
  }),
  headers: {
    'content-type': 'application/json',
  },
});
// }, 500);
