import { pick, assign } from 'lodash-es';

type PropsOnly<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

export default function baseMerge<T>(
  target: T,
  source: T,
  sourceKeys?: PropsOnly<T>[], // if there's no keys provided, we do a full merge
  // @ts-ignore
  assigns: Record<PropsOnly<T>, unknown> = {}
) {
  const pickedSource = sourceKeys ? pick(source, sourceKeys) : source;
  return assign(target, { ...pickedSource, ...assigns });
}
