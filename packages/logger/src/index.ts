import createLogger from './logger';
import createMockLogger from './mock';

export { createMockLogger };

export default createLogger;

export type { Logger } from './logger';
export type { LogOptions, LogLevel } from './options';