import util from 'node:util';

// TODO: what if we add a "fix" to each error?
// Maybe adminFix and userFix?
// This would be a human readable hint about what to do
// Or maybe summary/detail is a nicer approach
// message/explanation
// It would be nice for the detail to be in the error, not the code
// But that probably requires more detailed error types

// TODO it's annoying that for builtin errors I use constructor.name,
// but for my errors I use type
// I guess I'm happy to present a type to other consumers, but it does feel a little messy
// Note that I can't just use name either on the subclass because constructor.name is always Error
// Then again, ava tests depend on name - so maybe I need to remove type?
// Double buffering right now which is probably the worst solution...

export function assertImportError(e: any) {
  if (e.type === 'ImportError') {
    throw e;
  }
}

export function assertRuntimeError(e: any) {
  // Type errors occur so frequently, and are so likely to be
  // soft user errors, that we'll fail them
  if (e.constructor.name?.match(/RangeError|TypeError/)) {
    throw new RuntimeError(e);
  }
}

// See https://nodejs.org/api/errors.html for errors
export function assertRuntimeCrash(e: any) {
  // ignore  instanceof SystemError, AssertionError
  if (e.constructor.name.match(/ReferenceError|SyntaxError/)) {
    throw new RuntimeCrash(e);
  }
}

export function assertSecurityKill(e: any) {
  if (e.constructor.name === 'EvalError') {
    throw new SecurityError('Illegal eval statement detected');
  }
}

export function assertAdaptorError(e: any) {
  if (e.stack) {
    // parse the stack
    const frames = e.stack.split('\n');
    frames.shift(); // remove the first line

    const first = frames.shift();

    // For now, we assume this is adaptor code if it has not come directly from the vm
    // TODO: how reliable is this? Can we get a better heuristic?
    if (!first.match(/at vm:module\(0\)/)) {
      throw new AdaptorError(e);
    }
  }
}

// Abstract error supertype
export class RTError extends Error {
  source = 'runtime';
  includeStackTrace = false;
  type: string = '-';

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
  type = 'ValidationError';
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

// A runtime error traps a non-critical fail state
// The error is written to state and
// we can continue executing the workflow
export class RuntimeError extends RTError {
  severity = 'fail';
  subtype: string;
  type = 'RuntimeError';
  name = 'RuntimeError';

  constructor(error: Error) {
    super();
    this.subtype = error.constructor.name;
    this.message = `${this.subtype}: ${error.message}`;
  }
}

// A Runtime crash is a critical error which
// means the whole workflow is aborted
// The main runtime.run function should throw
export class RuntimeCrash extends RTError {
  severity = 'crash';
  subtype: string;
  type = 'RuntimeCrash';
  name = 'RuntimeCrash';

  constructor(error: Error) {
    super();
    this.subtype = error.constructor.name;
    this.message = `${this.subtype}: ${error.message}`;
  }
}

export class EdgeConditionError extends RTError {
  severity = 'crash';
  type = 'EdgeConditionError';
  name = 'EdgeConditionError';
  message: string;

  constructor(message: string) {
    super();
    this.message = message;
  }
}

export class InputError extends RTError {
  severity = 'crash';
  type = 'InputError';
  name = 'InputError';
  message: string;

  constructor(message: string) {
    super();
    this.message = message;
  }
}

export class AdaptorError extends RTError {
  type = 'AdaptorError';
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
  type = 'UserError';
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
  type = 'ImportError';
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
  type = 'SecurityError';
  name = 'SecurityError';
  // TODO I wonder if severity really is a concern for later.
  // The runtime just needs to decide whether to throw or trap any errors
  severity = 'kill';
  message: string;
  constructor(message: string) {
    super();
    this.message = message;
  }
}

export class TimeoutError extends RTError {
  type = 'TimeoutError';
  name = 'TimeoutError';
  severity = 'crash';
  message: string;
  constructor(duration: number) {
    super();
    this.message = `Job took longer than ${duration}ms to complete`;
  }
}
