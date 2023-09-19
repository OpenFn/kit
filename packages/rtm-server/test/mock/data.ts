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

export const attempts = {
  'attempt-1': {
    id: 'attempt-1',
    // TODO how should this be structure?
    input: {
      data: 'd',
    },
    triggers: [],
    edges: [],
    jobs: [
      {
        adaptor: '@openfn/language-common@1.0.0',
        body: 'fn(a => a)',
        credential: 'a',
      },
    ],
  },
};
