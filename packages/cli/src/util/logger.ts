// Wrapper around the logger API to load a namespaced logger with the right options
import actualCreateLogger, { printDuration } from '@openfn/logger';
import type { Opts } from '../options';

// TODO: add a "job" log level, which means, "only log job stuff"
export type { Logger, LogOptions, LogLevel } from '@openfn/logger';
export { isValidLogLevel, defaultLogger } from '@openfn/logger';

// All known loggers
export const CLI = 'cli';
export const COMPILER = 'compiler';
export const RUNTIME = 'runtime';
export const JOB = 'job';

const namespaces: Record<string, string> = {
  [CLI]: 'CLI',
  [RUNTIME]: 'R/T',
  [COMPILER]: 'CMP',
  [JOB]: 'JOB',
};

export const createLogger = (
  name: string = '',
  options: Partial<Pick<Opts, 'log' | 'logJson' | 'sanitize'>>
) => {
  const logOptions = options.log || {};
  let json = false;
  let level = logOptions[name] || logOptions.default || 'default';
  if (options.logJson) {
    json = true;
  }
  return actualCreateLogger(namespaces[name] || name, {
    level,
    json,
    sanitize: options.sanitize || 'none',
    ...logOptions,
  });
};

export default createLogger;

export const createNullLogger = () =>
  createLogger(undefined, { log: { default: 'none' } });

export { printDuration };
