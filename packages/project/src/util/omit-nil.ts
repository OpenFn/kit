import { omitBy, isNil } from 'lodash-es';

export const omitNil = (obj: any, key?: string) => {
  if (key && obj[key]) {
    obj[key] = omitBy(obj[key], isNil);
  } else {
    return omitBy(obj, isNil);
  }
};
export default omitNil;

export const tidyOpenfn = (obj: any) => omitNil(obj, 'openfn');
