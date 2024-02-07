import crypto from 'node:crypto';
import type {
  Step,
  StepId,
  ExecutionPlan,
  State,
  Job,
  Trigger,
  StepEdge,
  WorkflowOptions,
  Lazy,
} from '@openfn/lexicon';
import { Run, RunOptions, Edge } from '@openfn/lexicon/lightning';

export const conditions: Record<string, (upstreamId: string) => string | null> =
  {
    on_job_success: (upstreamId: string) =>
      `Boolean(!state?.errors?.["${upstreamId}"] ?? true)`,
    on_job_failure: (upstreamId: string) =>
      `Boolean(state?.errors && state.errors["${upstreamId}"])`,
    always: (_upstreamId: string) => null,
  };

const mapEdgeCondition = (edge: Edge) => {
  const { condition } = edge;
  if (condition && condition in conditions) {
    const upstream = (edge.source_job_id || edge.source_trigger_id) as string;
    return conditions[condition](upstream);
  }
  return condition;
};

const mapTriggerEdgeCondition = (edge: Edge) => {
  const { condition } = edge;
  // This handles cron triggers with undefined conditions and the 'always' string.
  if (condition === undefined || condition === 'always') return true;
  // Otherwise, we will return the condition and assume it's a valid JS expression.
  return condition;
};

const mapOptions = (
  runOptions: RunOptions = {},
  workflowOptions: WorkflowOptions = {}
): WorkflowOptions => {
  if (runOptions?.runTimeoutMs) {
    workflowOptions.timeout = runOptions?.runTimeoutMs;
  }
  if (runOptions?.sanitize) {
    workflowOptions.sanitize = runOptions?.sanitize;
  }
  return workflowOptions;
};

export default (
  run: Run
): { plan: ExecutionPlan; options: WorkflowOptions; input: Lazy<State> } => {
  const opts: WorkflowOptions = {};

  const plan: Partial<ExecutionPlan> = {
    id: run.id,
  };

  let initialState;
  if (run.dataclip_id) {
    initialState = run.dataclip_id;
  }

  if (run.starting_node_id) {
    opts.start = run.starting_node_id;
  }

  const nodes: Record<StepId, Step> = {};

  const edges: Edge[] = run.edges ?? [];

  // We don't really care about triggers, it's mostly just a empty node
  if (run.triggers?.length) {
    run.triggers.forEach((trigger: Trigger) => {
      const id = trigger.id || 'trigger';

      nodes[id] = {
        id,
      };

      // TODO do we need to support multiple edges here? Likely
      const connectedEdges = edges.filter((e) => e.source_trigger_id === id);
      if (connectedEdges.length) {
        nodes[id].next = connectedEdges.reduce(
          (obj: Partial<Trigger>, edge) => {
            if (edge.enabled !== false) {
              // @ts-ignore
              obj[edge.target_job_id] = mapTriggerEdgeCondition(edge);
            }
            return obj;
          },
          {}
        );
      } else {
        // TODO what if the edge isn't found?
      }
    });
  }

  if (run.jobs?.length) {
    run.jobs.forEach((step) => {
      const id = step.id || crypto.randomUUID();
      const job: Job = {
        id,
        configuration: step.credential || step.credential_id,
        expression: step.body!,
        adaptor: step.adaptor,
      };

      if (step.name) {
        job.name = step.name;
      }

      if (step.state) {
        job.state = step.state;
      }

      const next = edges
        .filter((e) => e.source_job_id === id)
        .reduce((obj, edge) => {
          const newEdge: StepEdge = {};

          const condition = mapEdgeCondition(edge);
          if (condition) {
            newEdge.condition = condition;
          }
          if (edge.enabled === false) {
            newEdge.disabled = true;
          }
          obj[edge.target_job_id] = Object.keys(newEdge).length
            ? newEdge
            : true;
          return obj;
        }, {} as Record<string, StepEdge>);

      if (Object.keys(next).length) {
        job.next = next;
      }

      nodes[id] = job;
    });
  }

  plan.workflow = {
    steps: Object.values(nodes),
  };

  if (run.name) {
    plan.workflow.name = run.name;
  }

  return {
    plan: plan as ExecutionPlan,
    options: mapOptions(run.options, opts),
    input: initialState || {},
  };
};
