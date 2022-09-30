// Mock logger which doesn't log anything
// TODO built in an API to return the history - very useful in unit tests
import createLogger from './logger';

const mockLogger = (opts: LogOptions = {}) => createLogger(undefined, {
  global: {
    level: 'none',
    ...opts,
  }
});

export default mockLogger;