/**
 * This simple module declares a local variable
 * And allows caller to increment it
 * It allows us to test the internal state of modules
 */
let count = 0;

export const increment = () => ++count;

export const getCount = () => count;
