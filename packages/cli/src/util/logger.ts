// Wrapper around the logger API to load a namespaced logger with the right options
import actualCreateLogger from '@openfn/logger';
export type { Logger, LogOptions, LogLevel } from '@openfn/logger';
import type { SafeOpts} from '../commands'

export const createLogger = (name: string = '', options: Pick<SafeOpts, 'log'>) => {
  const logOptions = options.log || {};
  let level = logOptions[name] || logOptions.default || 'default';
  return actualCreateLogger(name, {
    level,
    ...logOptions,
  })
}

export default createLogger;

export const createNullLogger = () => createLogger(undefined, { log: { default : 'none' } });