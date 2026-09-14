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
  const overrides: any = { ...pickedSource, ...assigns };
  const merged: any = assign({}, target, overrides);

  // null in an override (from source or assigns) is an explicit removal
  for (const key of Object.keys(overrides)) {
    if (overrides[key] === null) {
      delete merged[key];
    }
  }

  return merged;
}
