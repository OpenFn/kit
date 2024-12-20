// TODO: what if we add a "fix" to each error?
// Maybe adminFix and userFix?
// This would be a human readable hint about what to do
// Or maybe summary/detail is a nicer approach
// message/explanation
// It would be nice for the detail to be in the error, not the code
// But that probably requires more detailed error types

import expression, { ExecuteBreak } from './execute/expression'

export function assertImportError(e: any) {
  if (e.name === 'ImportError') {
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
    if (first && !first.match(/at vm:module\(0\)/)) {
      throw new AdaptorError(e);
    }
  }
}

// v8 only returns positional information as a string
// this function will pull the line/col information back out of it
export const extractPosition = (e: RTError) => {
  if (e.stack) {
    const [_message, frame1] = e.stack.split('\n');

    return extractPositionForFrame(frame1);
  }
};

// TODO move out into utils?
export const extractPositionForFrame = (frame: string) => {
  // find the line:col at the end
  // structures here https://nodejs.org/api/errors.html#errorstack
  const parts = frame.split(':');
  return {
    col: parseInt(parts.pop()!.replace(')', '')),
    line: parseInt(parts.pop()!),
  };
};

export const extractStackTrace = (e: RTError) => {
  if (e.stack) {
    const [message, ...frames] = e.stack.split('\n');

    const vmFrames = [];
    for (const frame of frames) {
      // TODO: what if we rename the VM?
      if (frame.includes("vm:module")) {
        vmFrames.push(frame)
      } else {
        break;
      }
    }

    return [message, ...vmFrames].join('\n')
  }
};

// Abstract error supertype
export class RTError extends Error {
  source = 'runtime';
  name: string = 'Error';
  pos?: { col: number, line: number} = undefined;

  constructor() {
    super();

    // automatically limit the stacktrace (?)
    Error.captureStackTrace(this, RTError.constructor);
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

// A runtime error traps a non-critical fail state
// The error is written to state and
// we can continue executing the workflow
export class RuntimeError extends RTError {
  severity = 'fail';
  subtype: string;
  name = 'RuntimeError';

  constructor(error: Error) {
    super();
    this.subtype = error.constructor.name;
    this.message = `${this.subtype}: ${error.message}`;

    this.pos = extractPosition(error);
    this.stack = extractStackTrace(error);
  }
}

// A Runtime crash is a critical error which
// means the whole workflow is aborted
// The main runtime.run function should throw
export class RuntimeCrash extends RTError {
  severity = 'crash';
  subtype: string;
  name = 'RuntimeCrash';

  constructor(error: Error) {
    super();
    this.subtype = error.constructor.name;
    this.message = `${this.subtype}: ${error.message}`;
    
    this.pos = extractPosition(error);
    this.stack = extractStackTrace(error);
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
  details: any;
  constructor(error: any) {
    super();
    this.details = error;
    if (typeof error === 'string') {
      this.message = error;
    } else if (error.message) {
      this.message = error.message;
    }
  }
}

// custom user error trow new Error() or throw {}
// Maybe JobError or Expression Error?
export class JobError extends RTError {
  name = 'JobError';
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
  name = 'TimeoutError';
  severity = 'kill';
  message: string;
  constructor(duration: number) {
    super();
    this.message = `Job took longer than ${duration}ms to complete`;
  }
}
