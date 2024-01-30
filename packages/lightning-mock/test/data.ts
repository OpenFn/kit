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
    dataclip_id: 'x',
    triggers: [],
    edges: [],
    jobs: [
      {
        id: 'a',
        adaptor: '@openfn/language-common@1.0.0',
        body: 'fn(a => a)',
        credential: 'abc',
      },
    ],
  },
};
