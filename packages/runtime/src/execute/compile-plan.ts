import type {
  CompiledExecutionPlan,
  CompiledJobEdge,
  ExecutionPlan,
  JobEdge,
} from '../types';

import compileFunction from '../modules/compile-function';
import { conditionContext, Context } from './context';

// Compile a shorthand edge or set of edges
// eg { start: 'a' }, { next: 'b' }, { start: { a: { condition: '!state.error' }}}
const compileEdges = (
  from: string,
  edges: string | Record<string, true | JobEdge>,
  context: Context
) => {
  if (typeof edges === 'string') {
    return { [edges]: {} };
  }
  const errs = [];

  const result = {} as Record<string, CompiledJobEdge>;
  for (const edgeId in edges) {
    try {
      const edge = edges[edgeId];
      const compiledEdge = {} as CompiledJobEdge;
      if (edge !== true) {
        if (typeof edge.condition === 'string') {
          compiledEdge.condition = compileFunction(edge.condition, context);
        } else {
          compiledEdge.condition = edge.condition;
        }
      }
      result[edgeId] = compiledEdge;
    } catch (e: any) {
      errs.push(
        new Error(
          `Failed to compile edge condition ${from}->${edgeId} (${e.message})`
        )
      );
    }
  }

  if (errs.length) {
    throw errs;
  }

  return result;
};

export default (plan: ExecutionPlan) => {
  let autoJobId = 0;
  const generateJobId = () => `job-${++autoJobId}`;
  const context = conditionContext();

  const errs: Error[] = [];

  const trapErrors = (fn: Function) => {
    try {
      fn();
    } catch (e: any | any[]) {
      if (Array.isArray(e)) {
        // If we've been thrown an array of errors, just add them to the collection
        errs.push(...e);
      } else {
        // Otherwise something else went wrong so we'll panic I guess
        throw e;
      }
    }
  };

  const newPlan = {
    jobs: {},
    start: plan.start,
  } as Pick<CompiledExecutionPlan, 'jobs' | 'start'>;

  for (const job of plan.jobs) {
    const jobId = job.id || generateJobId();
    if (!newPlan.start) {
      // Default the start job to the first
      newPlan.start = jobId;
    }
    newPlan.jobs[jobId] = {
      expression: job.expression, // TODO we should compile this here
    };
    if (job.data) {
      newPlan.jobs[jobId].data = job.data;
    }
    if (job.configuration) {
      newPlan.jobs[jobId].configuration = job.configuration;
    }
    if (job.next) {
      trapErrors(() => {
        newPlan.jobs[jobId].next = compileEdges(jobId, job.next!, context);
      });
    }
  }

  if (errs.length) {
    const e = new Error('compilation error');
    e.message = errs.map(({ message }) => message).join('\n\n');
    throw e;
  }

  return newPlan as CompiledExecutionPlan;
};
