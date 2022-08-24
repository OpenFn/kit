import { fn } from '@openfn/language-common';

export default [
  fn(() => {
    // Initialise somes tate
    return {
      data: {
        count: 1
      }
    }
  }),
  fn((state) => {
    state.data.count *= 10;
    return state;
  })
];
