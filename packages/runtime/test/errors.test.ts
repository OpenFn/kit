/**
  reproduce various errors and test how the runtime responds
  it should basically throw with a set of expected error cases
  
  InputError - the workflow structure failed validation
  RuntimeError - error while executing. This could have a subtype like TypeError, ReferenceError
                 It is a bit of a confusing name, is  JobError, ExpressionError or ExeuctionError better?
  CompileError - error while compiling code, probably a syntax error
  LinkerError - basically a problem loading any dependency (probably the adaptor)
                ModuleError? DependencyError? ImportError?
  TimeoutError - a job ran for too long
  ResolveError - a state or credential resolver failed (is this an input error?)
  
  what about code generation errors? That'll be a RuntimeError, should we treat it spedcially?
  SecurityError maybe?

  Note that there are errors we can't catch here, like memory or diskspace blowups, infinite loops.
  It's the worker's job to catch those and report the crash

  We'll have a RuntimeError type which has as reason string (that gets forwarded to the worker)
  a type and subtype, and a message

  Later we'll do stacktraces and positions and stuff but not now. Maybe for a JobError I guess?
 */
import test from 'ava';

test.todo('errors');
