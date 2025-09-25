export default function renameKeys(
  props: Record<string, unknown>,
  keyMap: Record<string, string>
) {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      keyMap[key] ? keyMap[key] : key,
      value,
    ])
  );
}
