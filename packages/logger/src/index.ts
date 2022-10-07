import createLogger from './logger';
import createMockLogger from './mock';
import isValidLogLevel from './util/is-valid-log-level';
import printDuration from './util/duration';

export { createMockLogger, isValidLogLevel, printDuration };

export default createLogger;

export type { Logger } from './logger';
export type { LogOptions, LogLevel } from './options';
