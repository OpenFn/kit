/**
 * A bunch of very simple  workflows that can be re-used
 */
export const ab = {
  id: 'workflow',
  name: 'Workflow',
  steps: [
    {
      id: 'a',
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
      id: 'b',
      name: 'b',
      openfn: {
        uuid: 2,
      },
    },
  ],
};
