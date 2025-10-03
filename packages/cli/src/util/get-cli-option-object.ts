export default function getCLIOptionObject(arg: unknown) {
  if (isObject(arg)) {
    return arg as Record<string, string>;
  } else if (typeof arg === 'string') {
    try {
      const p = JSON.parse(arg);
      if (isObject(p)) return p as Record<string, string>;
    } catch (e) {}
    return Object.fromEntries(
      arg.split(',').map((pair) => {
        const [k, v] = pair.split('=');
        return [k.trim(), v.trim()];
      })
    );
  }
}

function isObject(arg: unknown) {
  return typeof arg === 'object' && arg !== null && !Array.isArray(arg);
}
