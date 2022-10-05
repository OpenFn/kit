import createLogger from './logger';
import createMockLogger from './mock';
import  isValidLogLevel from './util/is-valid-log-level';

export { createMockLogger, isValidLogLevel };

export default createLogger;

export type { Logger } from './logger';
export type { LogOptions, LogLevel } from './options';