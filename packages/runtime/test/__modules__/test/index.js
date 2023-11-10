export const x = 'test';

export default x;

export const err = () => {
  throw new Error('adaptor err');
};

export const err2 = () => {
  throw 'adaptor err';
};
