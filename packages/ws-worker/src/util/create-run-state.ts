import type { ExecutionPlan } from '@openfn/runtime';
import type { RunOptions, RunState } from '../types';

export default (
  plan: ExecutionPlan,
  options: RunOptions = {}
): RunState => {
  const state = {
    plan,
    lastDataclipId: '',
    dataclips: {},
    inputDataclips: {},
    reasons: {},
    options,
  } as RunState;

  if (typeof plan.initialState === 'string') {
    // We need to initialise inputDataclips so that the first run
    // has its inputDataclip set properly
    // Difficulty: the starting node is a trigger and NOT a run
    // We need to find the first job with a body downstream of the start
    // and set the input state on THAT

    // find the first job
    let startNode = plan.jobs[0];
    if (plan.start) {
      startNode = plan.jobs.find(({ id }) => id === plan.start)!;
    }

    // TODO throw with validation error of some kind if this node could not be found

    const initialRuns: string[] = [];
    // If this is a trigger, get the downstream jobs
    if (!startNode.expression) {
      initialRuns.push(...Object.keys(startNode.next!));
    } else {
      initialRuns.push(startNode.id!);
    }

    // For any runs downstream of the initial state,
    // Set up the input dataclip
    initialRuns.forEach((id) => {
      state.inputDataclips[id] = plan.initialState as string;
    });
  } else {
    // what if initial state is an object?
    // In practice I don't think this will happen,
    // but the first input_state_id will be messed up
  }

  return state;
};
