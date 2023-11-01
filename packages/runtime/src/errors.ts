import util from 'node:util';

// This lets us distinguish runtime errors - which are crash
// - to user and adaptor errors, which are a fail
// See https://nodejs.org/api/errors.html for errors
export function isRuntimeError(e: any) {
  return (
    e.constructor.name === 'ReferenceError' ||
    e.constructor.name === 'TypeError' ||
    e.constructor.name === 'RangeError' ||
    e.constructor.name === 'SyntaxError' // compiler would be expected to catch these first
    // @ts-ignore
    // || e instanceof SystemError
  ); // nodejs error - fairly unlikely but possible, and definitely a crash state

  // Note: assertion error would be a user error
}

// Generic runtime execution error
// This is a wrapper around any node/js error thrown during execution
// Should log without stack trace, with RuntimeError type,
// and with a message (including subtype)
export class RuntimeError extends Error {
  source = 'runtime';

  severity = 'crash';

  name = 'RuntimeError';

  subtype = 'unknown';

  // error: Error;

  // stackTraceLimit = -1;

  // We want to get a stack trace relative to user code, not runtime code, for these
  constructor(error: Error) {
    super();

    // hack to stop a stack trace being generated
    // const { stackTraceLimit } = Error;
    // Error.stackTraceLimit = 0;
    // super();
    // Error.stackTraceLimit = stackTraceLimit;
    // console.log(error);

    // this.stack = 'wibble'; // clear the stack

    Error.captureStackTrace(this, RuntimeError.constructor);

    this.subtype = error.constructor.name;
    // this.error = error;
    // this.name = 'RuntimeError';
    this.message = `${this.subtype}: ${error.message}`;
  }

  // get [Symbol.toStringTag]() {
  //   return 'bar';
  // }

  // This is how we customise the error's logging in node
  // TODO how does this affect json logging?
  // Maybe we can provide a toJSON?
  // TODO why does this not get called when I extend error?
  // [util.inspect.custom](_depth, _options, _inspect) {
  //   // console.log(depth);
  //   // console.log(options);

  //   // TODO we should report
  //   const str = `[${this.name}] ${this.subtype}: ${this.message}`;

  //   return str;
  // }
}

export class InputError extends Error {
  source = 'runtime';

  severity = 'crash';

  type = 'InputError';

  message: string;

  constructor(message: string) {
    super();
    this.message = message;
  }
}

// How would we know if an error came from an adaptor?
export class AdaptorError extends Error {}

// custom user error trow new Error() or throw {}
export class UserError extends Error {
  name = 'UserError';
  source = 'runtime';
  severity = 'fail';
  message: string;
  constructor(error: any) {
    super();
    Error.captureStackTrace(this, UserError.constructor);

    if (typeof error === 'string') {
      this.message = error;
    } else if (error.message) {
      this.message = error.message;
    }
  }
}
