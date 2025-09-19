import pick from 'lodash/pick';
import merge from 'lodash/merge';
import assign from 'lodash/assign';

export default function baseMerge<T>(
  target: T,
  source: T,
  sourceKeys?: (keyof T)[], // if there's no keys provided, we do a full merge
  assigns: Record<keyof T, unknown> = {}
) {
  const pickedSource = sourceKeys ? pick(source, sourceKeys) : source;
  return assign(merge(target, pickedSource), assigns);
}
