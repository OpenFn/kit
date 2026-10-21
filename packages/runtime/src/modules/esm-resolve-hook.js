const shouldRetry = (err, specifier) =>
  err.code === 'ERR_MODULE_NOT_FOUND' && !/\.[a-z]+$/.test(specifier);

// For module.registerHooks()
export function resolveSync(specifier, context, nextResolve) {
  try {
    return nextResolve(specifier, context);
  } catch (err) {
    if (shouldRetry(err, specifier)) {
      return nextResolve(specifier + '.js', context);
    }
    throw err;
  }
}

// For module.register(), which loads this file on a separate thread
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (shouldRetry(err, specifier)) {
      return nextResolve(specifier + '.js', context);
    }
    throw err;
  }
}
