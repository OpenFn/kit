import util from 'node:util';

// TODO: what if we add a "fix" to each error?
// Maybe adminFix and userFix?
// This would be a human readable hint about what to do
// Or maybe summary/detail is a nicer approach
// message/explanation
// It would be nice for the detail to be in the error, not the code
// But that probably requires more detailed error types

// This lets us distinguish runtime errors - which are crash
// - to user and adaptor errors, which are a fail
// See https://nodejs.org/api/errors.html for errors

export function assertRuntimeError(e: any) {
  // Type errors occur so frequently, and are so likely to be
  // soft user errors, that we'll fail them
  if (e.type?.match(/RangeError|TypeError/)) {
    throw new RuntimeError(e)
  }
}

export function assertRuntimeCrash(e: any) {
  // ignore  instanceof SystemError, AssertionError
  if (
    e.constructor.name.match(/ReferenceError|SyntaxError/)) {
      throw new RuntimeCrash(e)
    }
  }

export function isAdaptorError(e: any) {
  if (e.stack) {
    // parse the stack
    const frames = e.stack.split('\n');
    frames.shift(); // remove the first line

    const first = frames.shift();

    // For now, we assume this is adaptor code if it has not come directly from the vm
    // TODO: how reliable is this? Can we get a better heuristic?
    if (!first.match(/at vm:module\(0\)/)) {
      return true;
    }
  }

  return false;
}

// Abstract error supertype
export class RTError extends Error {
  source = 'runtime';
  includeStackTrace = false;
  name: string = 'JAM';

  constructor() {
    super();

    // automatically limit the stacktrace (?)
    Error.captureStackTrace(this, RTError.constructor);

    // Provide custom rendering of the error in node
    // TODO we should include some kind of context where it makes sense
    // eg, if the error is associated with a job, show the job code
    // eg, if the error came from an expression, show the source and location
    // eg, if this came from our code, it doesn't help the user to see it but it does help us!
    // @ts-ignore
    this[util.inspect.custom] = (_depth, _options, _inspect) => {
      const str = `[${this.name}] ${this.message}`;

      // TODO include stack trace if the error demands it

      return str;
    };
  }
}

// Error thrown when validating a workflow (or something else?)
// TODO we should take a path to the invalid bit
export class ValidationError extends RTError {
  severity = 'crash';
  name = 'ValidationError';

  constructor(message: string) {
    super();
    this.message = message;
  }
}

// Generic runtime execution error
// This is a wrapper around any node/js error thrown during execution
// Should log without stack trace, with RuntimeError type,
// and with a message (including subtype)
export class RuntimeError extends RTError {
  severity = 'fail';
  subtype: string;
  name = 'RuntimeError';

  constructor(error: Error) {
    super();
    this.subtype = error.constructor.name;
    this.message = `${this.subtype}: ${error.message}`;
  }
}

export class RuntimeCrash extends RTError {
  severity = 'crash';
  subtype: string;
  name = 'RuntimeCrash';

  constructor(error: Error) {
    super();
    this.subtype = error.constructor.name;
    this.message = `${this.subtype}: ${error.message}`;
  }
}

export class EdgeConditionError extends RTError {
  severity = 'crash';
  name = 'EdgeConditionError';
  message: string;

  constructor(message: string) {
    super();
    this.message = message;
  }
}

export class InputError extends RTError {
  severity = 'crash';
  name = 'InputError';
  message: string;

  constructor(message: string) {
    super();
    this.message = message;
  }
}

export class AdaptorError extends RTError {
  name = 'AdaptorError';
  severity = 'fail';
  message: string = '';
  constructor(error: any) {
    super();

    if (typeof error === 'string') {
      this.message = error;
    } else if (error.message) {
      this.message = error.message;
    }
  }
}

// custom user error trow new Error() or throw {}
// Maybe JobError or Expression Error?
export class UserError extends RTError {
  name = 'UserError';
  severity = 'fail';
  message: string = '';
  constructor(error: any) {
    super();

    if (typeof error === 'string') {
      this.message = error;
    } else if (error.message) {
      this.message = error.message;
    }
  }
}

// Import error represents some kind of fail importing a module/adaptor
// The message will add context
// Some of these may need a stack trace for admins (but not for users)
export class ImportError extends RTError {
  name = 'ImportError';
  severity = 'crash';
  message: string;
  constructor(message: string) {
    super();
    this.message = message;
  }
}

// Eval (and maybe other security stuff)
export class SecurityError extends RTError {
  name = 'SecurityError';
  severity = 'crash';
  message: string;
  constructor(message: string) {
    super();
    this.message = message;
  }
}

export class TimeoutError extends RTError {
  name = 'TimeoutError';
  severity = 'crash';
  message: string;
  constructor(duration: number) {
    super();
    this.message = `Job took longer than ${duration}ms to complete`;
  }
}
