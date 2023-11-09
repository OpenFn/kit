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
  let message = null;
  //let source = null; // TODO unused right now

  if (error) {
    reason = error.severity ?? 'crash';
    message = error.message;
    error_type = error.subtype || error.type || error.name;
  } else if (state.errors?.[jobId]) {
    reason = 'fail';
    ({ message, type: error_type } = state.errors[jobId]);
  }
  return { reason, error_type, message };
};

const calculateAttemptExitReason = (state: AttemptState) => {
  // look at the job history and return the highest priority reason and message
  // TODO need to calculate this properly
  // Cheating for now so I can test job reasons
  // TODO actually we may need to key on run id, it's more useful
  const [reason] = Object.values(state.reasons) as ExitReason[];

  // TODO include run id too

  // TODO what if somehow there are no runs?

  return reason;
};

export { calculateJobExitReason, calculateAttemptExitReason };
