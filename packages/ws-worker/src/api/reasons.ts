import { AttemptState } from './execute';
import type { ExitReason, ExitReasonStrings, State } from '../types';

// This takes the result state and error from the job
const calculateJobExitReason = (
  jobId: string,
  state: State,
  error?: any
): ExitReason => {
  let reason: ExitReasonStrings = 'success';
  let error_type = null;
  let error_message = null;
  //let source = null; // TODO unused right now

  if (error) {
    reason = error.severity ?? 'crash';
    error_message = error.message;
    error_type = error.subtype || error.type || error.name;
  } else if (state.errors?.[jobId]) {
    reason = 'fail';
    ({ message: error_message, type: error_type } = state.errors[jobId]);
  }
  return { reason, error_type, error_message };
};

const calculateAttemptExitReason = (state: AttemptState) => {
  if (state.reasons) {
    // A crash or greater will trigger an error, and the error
    // basically becomes the exit reason

    // So If we get here, we basically just need to look for the first fail
    // otherwise we return ok
    const fail = Object.values(state.reasons).find(
      ({ reason }) => reason === 'fail'
    );

    return fail || { reason: 'success', error_type: null, error_message: null };
  }
  // TODO what if somehow there are no runs?
};

export { calculateJobExitReason, calculateAttemptExitReason };
