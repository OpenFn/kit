export default function getDuplicates<T>(arr: Array<T>) {
  // @ts-ignore
  const hmap: Record<T, boolean> = {};
  const duplicates = new Set<T>();
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (hmap[item]) duplicates.add(item);
    else hmap[item] = true;
  }
  return Array.from(duplicates);
}
