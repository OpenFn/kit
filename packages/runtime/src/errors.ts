import { ErrorPosition } from './types';

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

// Adaptor errors are caught and generated deep inside the runtime
// So they're easy to detect and we just re-throw them here
export function assertAdaptorError(e: any) {
  if (e.name === 'AdaptorError') {
    throw e;
  }
}

// v8 only returns positional information as a string
// this function will pull the line/col information back out of it
export const extractPosition = (e: Error) => {
  if (e.stack) {
    const [_message, ...frames] = e.stack.split('\n');
    while (frames.length) {
      const pos = extractPositionForFrame(frames.shift()!);
      if (pos) {
        return pos;
      }
    }
  }
};

export const extractPositionForFrame = (
  frame: string
): ErrorPosition | undefined => {
  // find the line:col at the end of the line
  // structures here https://nodejs.org/api/errors.html#errorstack
  if (frame.match(/\d+:\d+/)) {
    const parts = frame.split(':');
    return {
      column: parseInt(parts.pop()!.replace(')', '')),
      line: parseInt(parts.pop()!),
    };
  }
};

export const extractStackTrace = (e: Error) => {
  if (e.stack) {
    const [message, ...frames] = e.stack.split('\n');

    const vmFrames = [];
    for (const frame of frames) {
      // TODO: what if we rename the VM?
      if (frame.includes('vm:module')) {
        vmFrames.push(frame);
      } else {
        break;
      }
    }

    return [message, ...vmFrames].join('\n');
  }
};

// Abstract error supertype
export class RTError extends Error {
  source = 'runtime';
  name: string = 'Error';
  pos?: ErrorPosition;
  step?: string;

  constructor() {
    super();

    // automatically limit the stacktrace (?)
    // TODO: actually what we want here is to online include frames
    // from inside the VM
    // Anything outside the VM should be cut
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
  line: number = -1;
  operationName: string = '';

  constructor(error: any, line?: number, operationName?: string) {
    super();
    if (!isNaN(line!)) {
      this.line = line!;
    }
    if (operationName) {
      this.operationName = operationName;
    }

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
