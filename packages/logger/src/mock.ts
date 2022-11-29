// Mock logger which doesn't log anything
// TODO built in an API to return the history - very useful in unit tests
import createLogger, { Logger, LogFns } from './logger';
import type { LogOptions, LogEmitter } from './options';

// Each log message is saved as the level, then whatever was actually logged
type LogMessage = [LogFns | 'confirm' | 'print', ...any[]];

type MockLogger = Logger & {
  _last: LogMessage; // the last log message
  _history: any[]; // everything logged
  _reset: () => void; // reset history
  _parse: (m: LogMessage) => {
    level: string;
    namespace?: string;
    icon?: string;
    message: string | object;
    messageRaw: any[];
  };
};

// TODO options need to be namespaced
const mockLogger = (name?: string, opts: LogOptions = {}): MockLogger => {
  const history: LogMessage[] = [];

  const logger = {
    ...console,
  } as LogEmitter;

  ['log', 'info', 'success', 'debug', 'warn', 'error'].forEach((l) => {
    const level = l as LogFns;
    logger[level] = (...out: any[]) => {
      history.push([level, ...out]);
    };
  });

  const m: unknown = createLogger(name, {
    logger,
    ...opts,
  });

  // Type shenanegans while we append the mock APIs
  const mock = m as MockLogger;

  mock.print = (...out: any[]) => {
    if (opts.level !== 'none') {
      history.push(['print', ...out]);
    }
  };

  Object.defineProperty(mock, '_last', {
    get: () => history[history.length - 1] || [],
  });
  mock._history = history;
  mock._reset = () => {
    history.splice(0, history.length);
  };
  // intelligently parse log output based on options
  mock._parse = (log: LogMessage) => {
    let level = '';
    let namespace = '';
    let icon = '';
    let messageParts = [];

    if (log[0] === 'confirm') {
      return { level: 'confirm', message: log[1], messageRaw: [log[1]] };
    }
    if (log[0] === 'print') {
      return { level: 'print', message: log[1], messageRaw: [log[1]] };
    }

    if (name && !opts.hideNamespace && !opts.hideIcons) {
      [level, namespace, icon, ...messageParts] = log;
    } else if (name && !opts.hideNamespace) {
      [level, namespace, ...messageParts] = log;
    } else if (!opts.hideIcons) {
      [level, icon, ...messageParts] = log;
    } else {
      [level, ...messageParts] = log;
    }

    // Simplified message handling
    // If the first argument is a string, join the whole message into one friendly string
    // (ie how a user would see it)
    // If the first argument is an object, make that the message
    // TODO this won't scale very far
    let message = '';
    if (typeof messageParts[0] === 'string') {
      message = messageParts.join(' ');
    } else {
      message = messageParts[0];
    }

    return {
      level,
      // Chop out the square brackets from the namespace, it's a style thing and annoying in tests
      namespace: namespace.substring(1, namespace.length - 1),
      icon,
      message,
      messageRaw: messageParts,
    };
  };

  /*
   * Any unit tests with confirm prompts should:
   * a) auto-confirm the prompt
   * b) see a confirm message in the log history
   */
  mock.confirm = async (message: string) => {
    history.push(['confirm', message]);
    return true;
  };

  return mock;
};

export default mockLogger;
