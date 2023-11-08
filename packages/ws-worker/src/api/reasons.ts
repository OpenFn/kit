import { AttemptState } from "./execute";

// This takes the result state and error from the job
const calculateJobReason = (jobId: string, state: any, error: any) => {
  let reason = 'ok';
  let error_type = '';
  let message = 'none';
  let source = '';

  if (error) {
    reason = 'crash'; // TODO could be Killed?
  } else if (state.errors[jobId]) {
    reason = 'fail';
  }

  return { reason, error_type, message, source };
}

const calculateAttemptReason = (state: AttemptState) => {
  // look at the job history and return the highest priority reason and message
}

export { calculateJobReason, calculateAttemptReason}