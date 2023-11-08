import { AttemptState } from "./execute";

const nil = '-';

// This takes the result state and error from the job
const calculateJobReason = (jobId: string, state: any, error: any) => {
  let reason = 'success';
  let error_type = nil;
  let message = nil;
  let source = nil; 

  if (error) {
    reason = 'crash'; // TODO could be Killed?
  } else if (state.errors?.[jobId]) {
    reason = state.errors[jobId].severity;
    message = state.errors[jobId].message;
    error_type = state.errors[jobId].type;
  }

  return { reason, error_type, message, source };
}

const calculateAttemptReason = (state: AttemptState) => {
  // look at the job history and return the highest priority reason and message
}

export { calculateJobReason, calculateAttemptReason}