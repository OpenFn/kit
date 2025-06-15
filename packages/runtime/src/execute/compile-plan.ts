import type {
  CompiledEdge,
  CompiledExecutionPlan,
  CompiledStep,
} from '../types';

import compileFunction from '../modules/compile-function';
import { conditionContext, Context } from './context';
import { ExecutionPlan, Job, StepEdge, Workflow } from '@openfn/lexicon';
import { getNameAndVersion } from '../modules/repo';

const compileEdges = (
  from: string,
  edges: string | Record<string, boolean | StepEdge>,
  context: Context
) => {
  if (typeof edges === 'string') {
    return { [edges]: true };
  }
  const errs = [];

  const result = {} as Record<string, boolean | CompiledEdge>;
  for (const edgeId in edges) {
    try {
      const edge = edges[edgeId];
      if (typeof edge === 'boolean') {
        result[edgeId] = edge;
      } else if (typeof edge === 'string') {
        result[edgeId] = { condition: compileFunction(edge, context) };
      } else {
        const newEdge = {
          ...edge,
        };
        if (typeof edge.condition === 'string') {
          (newEdge as any).condition = compileFunction(edge.condition, context);
        }
        result[edgeId] = newEdge as CompiledEdge;
      }
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

// find the upstream job for a given job
// Inefficient but fine for now (note that validation does something similar)
// Note that right now we only support one upstream job
const findUpstream = (workflow: Workflow, id: string) => {
  for (const job of workflow.steps) {
    if (job.next)
      if (typeof job.next === 'string') {
        if (job.next === id) {
          return job.id;
        }
      } else if (job.next[id]) {
        return job.id;
      }
  }
};

export default (plan: ExecutionPlan) => {
  const { workflow, options = {} } = plan;
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

  for (const job of workflow.steps) {
    if (!job.id) {
      job.id = generateJobId();
    }
  }

  const newPlan: CompiledExecutionPlan = {
    workflow: {
      steps: {},
    },
    options: {
      ...options,
      start: options.start ?? workflow.steps[0]?.id!,
    },
  };

  if (typeof workflow.globals === 'string')
    newPlan.workflow.globals = workflow.globals;

  if (workflow.credentials) {
    newPlan.workflow.credentials = workflow.credentials;
  }

  const maybeAssign = (a: any, b: any, keys: Array<keyof Job>) => {
    keys.forEach((key) => {
      if (a.hasOwnProperty(key)) {
        b[key] = a[key];
      }
    });
  };

  for (const step of workflow.steps) {
    const job = step as Job;
    const stepId = step.id!;
    const newStep: CompiledStep = {
      id: stepId,
    };

    maybeAssign(step, newStep, [
      'expression',
      'state',
      'configuration',
      'name',
      'sourceMap', // TODO need unit tests against this
    ]);

    if (job.linker) {
      newStep.linker = job.linker;
    } else if (job.adaptors) {
      const job = step as Job;
      newStep.linker ??= {};
      for (const adaptor of job.adaptors!) {
        const { name, version } = getNameAndVersion(adaptor);
        newStep.linker[name] = { version: version! };
      }
    }

    if (step.next) {
      trapErrors(() => {
        newStep.next = compileEdges(stepId, step.next!, context);
      });
    }
    newStep.previous = findUpstream(workflow, stepId);
    newPlan.workflow.steps[stepId] = newStep;
  }

  if (errs.length) {
    const e = new Error('compilation error');
    e.message = errs.map(({ message }) => message).join('\n\n');
    throw e;
  }

  return newPlan as CompiledExecutionPlan;
};
