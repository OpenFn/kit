// Wrapper around the logger API to load a namespaced logger with the right options
import actualCreateLogger from '@openfn/logger';
export type { Logger, LogOptions, LogLevel } from '@openfn/logger';
import type { SafeOpts} from '../commands'

// All known loggers
export const CLI = 'cli';
export const COMPILER = 'compiler';
export const RUNTIME = 'runtime';
export const JOB = 'job';

const namespaces: Record<string, string> = {
  [CLI]: 'CLI',
  [RUNTIME]: 'R/T',
  [COMPILER]: 'CMP',
  [JOB]: 'JOB'
}

export const createLogger = (name: string = '', options: Pick<SafeOpts, 'log'>) => {
  const logOptions = options.log || {};
  let level = logOptions[name] || logOptions.default || 'default';
  return actualCreateLogger(namespaces[name] || name, {
    level,
    ...logOptions,
  })
}

export default createLogger;

export const createNullLogger = () => createLogger(undefined, { log: { default : 'none' } });