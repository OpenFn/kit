// Mock logger which doesn't log anything
// TODO built in an API to return the history - very useful in unit tests
import createLogger from './logger';

// Each log message is saved as the level, then whatever was actually logged
type LogMessage = [LogFns, ...any[]];

type MockLogger = Logger & {
  _last: LogMessage; // the last log message
  _history: any[]; // everything logged
  _reset: () => void; // reset history
}

// TODO options need to be namespaced
const mockLogger = (name?: string, opts: LogOptions = {}): MockLogger => {
  const history: LogMessage[] = [];

  const logger = {
    ...console
  };

  ['log', 'info', 'success', 'debug', 'warn', 'error'].forEach((l) => {
    const level = l as LogFns;
    logger[level] = (...out: any[]) => {
      history.push([level, ...out]);
    }
  });
  
  const m: unknown = createLogger(name, {
    logger,
    ...opts,
  });

  // Type shenanegans while we append the mock APIs
  const mock = m as MockLogger;
  
  Object.defineProperty(mock, '_last', {
    get: () => history[history.length - 1] || []
  });
  mock._history = history;
  mock._reset = () => {
    history.splice(0, history.length);
  }

  return mock;
};

export default mockLogger;