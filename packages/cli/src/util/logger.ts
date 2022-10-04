// Wrapper around the logger API to load a namespaced logger with the right options
import createLogger from '@openfn/logger';
export type { Logger, LogOptions, LogLevel } from '@openfn/logger';
import type { SafeOpts } from '../commands'

export default (name: string, options: SafeOpts) => {
  const logOptions = options.log || {};
  let level = logOptions[name] || logOptions.default || 'default';
  return createLogger(name, {
    level,
    ...logOptions,
  })
}

export const createNullLogger = () => createLogger(undefined, { level: 'none' });