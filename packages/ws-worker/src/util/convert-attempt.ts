import crypto from 'node:crypto';
import type {
  ExecutionPlan,
  JobNode,
  JobNodeID,
  JobEdge,
} from '@openfn/runtime';
import { Attempt } from '../types';

export default (attempt: Attempt): ExecutionPlan => {
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
          if (edge.condition) {
            newEdge.condition = edge.condition;
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

  return plan as ExecutionPlan;
};
