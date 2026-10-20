import { writeSync } from 'node:fs';

// Writes each specifier it resolves to stderr. Registered beneath the ESM hook,
// it sees every attempt the hook makes.
export function resolve(specifier, context, nextResolve) {
  writeSync(2, `${specifier}\n`);
  return nextResolve(specifier, context);
}
