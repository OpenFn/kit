import type { ExecutionPlan, Job, Lazy, State } from '@openfn/lexicon';
import type { RunState } from '../types';

export default (plan: ExecutionPlan, input?: Lazy<State>): RunState => {
  const state = {
    lastDataclipId: '',
    dataclips: {},
    inputDataclips: {},
    reasons: {},
    plan,
    input,
  } as RunState;

  if (typeof input === 'string') {
    // We need to initialise inputDataclips so that the first run
    // has its inputDataclip set properly
    // Difficulty: the starting node is a trigger and NOT a run
    // We need to find the first job with a body downstream of the start
    // and set the input state on THAT

    // find the first job
    const jobs = plan.workflow.steps as Job[];
    let startNode = jobs[0];
    if (plan.options.start) {
      startNode = jobs.find(({ id }) => id === plan.options.start)!;
    }

    const initialRuns: string[] = [];
    // Note that the workflow hasn't been properly validated yet
    // and it's technically possible that there is no start node
    if (startNode) {
      // If this is a trigger, get the downstream jobs
      if (!startNode.expression) {
        initialRuns.push(...Object.keys(startNode.next!));
      } else {
        initialRuns.push(startNode.id!);
      }
    }

    // For any runs downstream of the initial state,
    // Set up the input dataclip
    initialRuns.forEach((id) => {
      state.inputDataclips[id] = input;
    });
  } else {
    // what if initial state is an object?
    // In practice I don't think this will happen,
    // but the first input_state_id will be messed up
  }

  return state;
};
