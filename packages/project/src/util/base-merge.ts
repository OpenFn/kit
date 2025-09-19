import pick from 'lodash/pick';
import merge from 'lodash/merge';
import assign from 'lodash/assign';

type PropsOnly<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

export default function baseMerge<T>(
  target: T,
  source: T,
  sourceKeys?: PropsOnly<T>[], // if there's no keys provided, we do a full merge
  assigns: Record<PropsOnly<T>, unknown> = {}
) {
  const pickedSource = sourceKeys ? pick(source, sourceKeys) : source;
  return assign(merge(target, pickedSource), assigns);
}
