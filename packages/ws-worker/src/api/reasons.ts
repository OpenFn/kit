import { State, Step } from '@openfn/lexicon';
import { ExitReason, ExitReasonStrings } from '@openfn/lexicon/lightning';
import type { RunState } from '../types';

// This takes the result state and error from the job
const calculateJobExitReason = (
  jobId: string,
  state: State = { data: {} }, // If somehow there is no state with the job, this function must not explode
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

// It has next jobs, but they weren't executed
const isLeafNode = (state: RunState, job: Step) => {
  // A node is a leaf if:
  // It has no `next` jobs at all
  if (!job.next || Object.keys(job.next).length == 0) {
    return true;
  }
  // It has next jobs, but not of them were executed
  const hasDownstream = Object.keys(job.next).find((id) => state.reasons[id]);
  return !hasDownstream;
};

const calculateRunExitReason = (state: RunState): ExitReason => {
  if (state.plan && state.reasons) {
    // A crash or greater will trigger an error, and the error
    // basically becomes the exit reason
    // So If we get here, we basically just need to look to see if there's a fail on a leaf node
    // (we ignore fails on non-leaf nodes)
    const leafJobReasons: ExitReason[] = state.plan.workflow.steps
      .filter((job) => isLeafNode(state, job))
      // TODO what if somehow there is no exit reason for a job?
      // This implies some kind of exception error, no?
      .map(({ id }) => state.reasons[id!]);

    const fail = leafJobReasons.find((r) => r && r.reason === 'fail');
    if (fail) {
      return fail;
    }
  }
  return { reason: 'success', error_type: null, error_message: null };
};

export { calculateJobExitReason, calculateRunExitReason };
