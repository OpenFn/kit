export const credentials = {
  a: {
    user: 'bobby',
    password: 'password1',
  },
};

export const dataclips = {
  d: {
    count: 1,
  },
};

export const runs = {
  'run-1': {
    id: 'run-1',
    // TODO how should this be structure?
    input: {
      data: 'd',
    },
    triggers: [],
    edges: [],
    jobs: [
      {
        id: 'job-1',
        adaptor: '@openfn/language-common@1.0.0',
        body: 'fn(a => a)',
        credential_id: 'a',
      },
    ],
  },
};
