type SerializedError = {
  type: string; // the error name

  message?: string; // If we support error objects, we can't guarantee a message

  // A dump of error details
  details?: Record<string, any>;

  // TODO handle this later
  location?: any;
  stacktrace?: string;
};

// This is my new error serializer
// Just like the runtime guarantees to return a serialisable object,
// it will also throw a serializable error
export function serialize(error: any): SerializedError {
  if (error.$serialized) {
    throw error;
  }

  // Wrap all errors up with a special key that lets us know its been processed
  const wrap = (e: any): SerializedError => {
    Object.defineProperty(e, '$serialized', {
      enumerable: false,
      writable: false,
      value: true,
    });
    return e;
  };

  if (error instanceof Error) {
    const details: SerializedError['details'] = {};

    const e: Partial<SerializedError> = {
      type: error.name,
      message: error.message,
    };
    // TODO use a helper for this
    if (error.severity) {
      e.severity = error.severity;
    }
    if (error.source) {
      e.source = error.source;
    }
    // assign details here at the bottom so it'll serialize better
    e.details = details;

    for (const key in error) {
      //if (!/^(message|name|severity|)$/.test(key)) {
      if (!e[key] && key !== 'name') {
        if (error[key] instanceof Error) {
          for (const ekey in error[key]) {
            details[ekey] = error[key][ekey];
          }
        } else {
          // TODO the key is an error object, we need to serialize that nicely too
          details[key] = error[key];
        }
      }
    }
    return wrap(e);
  } else if (typeof error === 'string') {
    // TODO maybe capture a stack trace from here?
    // https://nodejs.org/api/errors.html#errorcapturestacktracetargetobject-constructoropt
    return wrap({
      type: 'Error',
      message: error,
    });
  } else {
    return wrap({
      type: 'Error',
      // This is a bit of wierd one
      // It doesn't help anyone for us to make up an error
      // But I also want to guarante that the error has a human readable message
      // I guess I can't do that!
      // message: error.message ?? 'An error occurred',
      details: error,
    });
  }
}

// TODO I really  want to clean up some of this stuff, it's just not right

// TODO it's annoying that for builtin errors I use constructor.name,
// but for my errors I use type
// I guess I'm happy to present a type to other consumers, but it does feel a little messy
// Note that I can't just use name either on the subclass because constructor.name is always Error
// Then again, ava tests depend on name - so maybe I need to remove type?
// Double buffering right now which is probably the worst solution...

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

// Abstract error supertype
export class RTError extends Error {
  source = 'runtime';

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
// and with a message (including type)

// A runtime error traps a non-critical fail state
// The error is written to state and
// we can continue executing the workflow
export class RuntimeError extends RTError {
  severity = 'fail';
  type: string;
  name = 'RuntimeError';

  constructor(error: Error) {
    super();
    this.type = error.constructor.name;
    this.message = error.message;
  }
}

// A Runtime crash is a critical error which
// means the whole workflow is aborted
// The main runtime.run function should throw
export class RuntimeCrash extends RTError {
  severity = 'crash';
  type: string;
  name = 'RuntimeCrash';

  constructor(error: Error) {
    super();
    this.type = error.constructor.name;
    this.message = error.message;
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

// Aha - a big part of my problem is that the adaptor error is swalloing
// all the good stuff
export class AdaptorError extends RTError {
  name = 'AdaptorError';
  severity = 'fail';
  message: string = '';

  error: any;
  constructor(error: any) {
    super();

    if (typeof error === 'string') {
      this.message = error;
    } else if (error.message) {
      this.message = error.message;
    }
    this.error = error;
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
