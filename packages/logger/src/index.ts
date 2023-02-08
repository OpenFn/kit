import createLogger from './logger';
import createMockLogger from './mock';
import isValidLogLevel from './util/is-valid-log-level';
import printDuration from './util/duration';

export { createMockLogger, isValidLogLevel, printDuration };

export const defaultLogger = createLogger();

export default createLogger;

export type { Logger, JSONLog, StringLog } from './logger';
export type { LogOptions, LogLevel } from './options';
