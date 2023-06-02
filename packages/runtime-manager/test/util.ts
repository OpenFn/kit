export const createPlan = (job = {}) => ({
  id: 'wf-1',
  jobs: [
    {
      id: 'j1',
      adaptor: 'common', // not used
      credential: {}, // not used
      data: {}, // Used if no expression
      expression: JSON.stringify({ data: { answer: 42 } }), // Will be parsed
      _delay: 1, // only used in the mock

      ...job,
    },
  ],
});
