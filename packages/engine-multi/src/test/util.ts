import { ExecutionPlan } from '@openfn/lexicon';

export const createPlan = (job = {}) =>
  ({
    id: 'wf-1',
    workflow: {
      steps: [
        {
          id: 'j1',
          adaptor: 'common', // not used
          configuration: {}, // not used
          expression: '(s) => ({ data: { answer: s.data?.input || 42 } })',

          // TODO is this actually used? Should I get rid? Underscore
          // @ts-ignore
          data: {}, // Used if no expression

          // @ts-ignore
          _delay: 1, // only used in the mock

          ...job,
        },
      ],
    },
    options: {},
  } as ExecutionPlan);
