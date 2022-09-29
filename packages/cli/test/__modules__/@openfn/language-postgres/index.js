export const execute = () => () => "execute called!";

export const fn = (f) => (state) => f(state);