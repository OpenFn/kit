// Mock logger which doesn't log anything
// TODO built in an API to return the history - very useful in unit tests
import createLogger, { Logger, LogFns } from './logger';
import type { LogOptions, LogEmitter } from './options';

// Each log message is saved as the level, then whatever was actually logged
type LogMessage = [LogFns, ...any[]];

type MockLogger = Logger & {
  _last: LogMessage; // the last log message
  _history: any[]; // everything logged
  _reset: () => void; // reset history
  _parse: (m: LogMessage) => {
    level: string;
    namespace?: string;
    icon?: string;
    message: string;
  }
}

// TODO options need to be namespaced
const mockLogger = (name?: string, opts: LogOptions = {}): MockLogger => {
  const history: LogMessage[] = [];

  const logger = {
    ...console
  } as LogEmitter;

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
  // intelligently parse log output based on options
  mock._parse = (log: LogMessage) => {
    let level = '';
    let namespace = '';
    let icon = '';
    let message = [];
    
    if (name && !opts.hideNamespace && !opts.hideIcons) {
      [level, namespace, icon, ...message ] = log;
    } else if(name && !opts.hideNamespace) {
      [level, namespace, ...message ] = log;
    } else if(!opts.hideIcons) {
      [level, icon, ...message ] = log;
    } else {
      [level, ...message ] = log;
    }
     
    return {
      level,
      // Chop out the square brackets from the namespace, it's a style thing and annoying in tests
      namespace: namespace.substring(1, namespace.length - 1),
      icon,
      message: message.join(' ')
    };
  };

  return mock;
};

export default mockLogger;