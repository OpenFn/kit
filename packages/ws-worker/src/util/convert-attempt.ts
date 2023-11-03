import crypto from 'node:crypto';
import type {
  JobNode,
  JobNodeID,
  JobEdge,
  ExecutionPlan,
} from '@openfn/runtime';
import { Attempt, AttemptOptions } from '../types';

const conditions: Record<string, any> = {
  on_job_success: '!state.errors',
  on_job_failure: 'state.errors',
  always: null,
};

const mapEdgeCondition = (condition: string) => {
  if (condition in conditions) {
    return conditions[condition];
  }
  return condition;
};

export default (
  attempt: Attempt
): { plan: ExecutionPlan; options: AttemptOptions } => {
  const options = attempt.options || {};
  const plan: Partial<ExecutionPlan> = {
    id: attempt.id,
  };

  if (attempt.dataclip_id) {
    // This is tricky - we're assining a string to the XPlan
    // which is fine becuase it'll be handled later
    // I guess we need a new type for now? Like a lazy XPlan
    // @ts-ignore
    plan.initialState = attempt.dataclip_id;
  }
  if (attempt.starting_node_id) {
    plan.start = attempt.starting_node_id;
  }

  const nodes: Record<JobNodeID, JobNode> = {};

  const edges = attempt.edges ?? [];

  // We don't really care about triggers, it's mostly just a empty node
  if (attempt.triggers?.length) {
    attempt.triggers.forEach((trigger) => {
      const id = trigger.id || 'trigger';

      nodes[id] = {
        id,
      };

      // TODO do we need to support multiple edges here? Likely
      const connectedEdges = edges.filter((e) => e.source_trigger_id === id);
      if (connectedEdges.length) {
        nodes[id].next = connectedEdges.reduce((obj, edge) => {
          if (edge.enabled !== false) {
            // @ts-ignore
            obj[edge.target_job_id] = true;
          }
          return obj;
        }, {});
      } else {
        // TODO what if the edge isn't found?
      }
    });
  }

  if (attempt.jobs?.length) {
    attempt.jobs.forEach((job) => {
      const id = job.id || crypto.randomUUID();

      nodes[id] = {
        id,
        configuration: job.credential,
        expression: job.body,
        adaptor: job.adaptor,
      };

      if (job.state) {
        // TODO this is likely to change
        nodes[id].state = job.state;
      }

      const next = edges
        .filter((e) => e.source_job_id === id)
        .reduce((obj, edge) => {
          const newEdge: JobEdge = {};

          const condition = mapEdgeCondition(edge.condition);
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
        }, {} as Record<string, JobEdge>);

      if (Object.keys(next).length) {
        nodes[id].next = next;
      }
    });
  }

  plan.jobs = Object.values(nodes);

  return {
    plan: plan as ExecutionPlan,
    options,
  };
};
