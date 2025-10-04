/**
 * A bunch of very simple  workflows that can be re-used
 */
export const ab = {
  steps: [
    {
      name: 'a',
      openfn: {
        uuid: 1,
      },
      next: {
        b: {
          openfn: {
            uuid: 3,
          },
        },
      },
    },
    {
      name: 'b',
      openfn: {
        uuid: 2,
      },
    },
  ],
};
