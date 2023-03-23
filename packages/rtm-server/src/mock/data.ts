export const credentials = () => ({
  a: {
    user: 'bobby',
    password: 'password1',
  },
});

export const attempts = () => ({
  'attempt-1': {
    id: 'attempt-1',
    input: {
      data: {},
    },
    plan: [
      {
        adaptor: '@openfn/language-common@1.0.0',
        expression: 'fn(a => a)',
        credential: 'a',
      },
    ],
  },
});
