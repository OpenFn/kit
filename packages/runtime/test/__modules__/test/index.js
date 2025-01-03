export const x = 'test';

export default x;

export const err = () => {
  return async (state) => {
    debugger;
    const e = new Error('adaptor err');
    e.code = 1234;
    throw e;
  };
};

export const err2 = () => {
  throw 'adaptor err';
};

// trying to repro https://github.com/OpenFn/kit/issues/520
export function call(fn) {
  return (state) => {
    try {
      return { data: fn(state) };
    } catch (e) {
      throw e;
    }
  };
}
