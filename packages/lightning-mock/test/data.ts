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
