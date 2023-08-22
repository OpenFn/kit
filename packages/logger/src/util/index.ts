import duration from './duration';
import isValidLogLevel from './is-valid-log-level';

const isObject = (thing: any) => {
  if (Array.isArray(thing) || thing === null || thing instanceof Error) {
    return false;
  }

  if (typeof thing === 'object') {
    return true;
  }
  return false;
};

const isArray = Array.isArray;

export { duration, isValidLogLevel, isObject, isArray };
