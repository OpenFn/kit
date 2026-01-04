import { omitBy, isNil } from 'lodash-es';

export const omitNil = (obj: any, key: string) => {
  if (obj[key]) {
    obj[key] = omitBy(obj[key], isNil);
  }
};
export default omitNil;

export const tidyOpenfn = (obj: any) => omitNil(obj, 'openfn');
