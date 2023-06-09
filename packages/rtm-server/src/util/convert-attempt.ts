import type { ExecutionPlan, JobNode, JobNodeID } from '@openfn/runtime';
import { Attempt } from '../types';

export default (attempt: Attempt): ExecutionPlan => {
  const plan: Partial<ExecutionPlan> = {
    id: attempt.id,
  };

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
          // @ts-ignore
          obj[edge.target_job_id] = true;
          return obj;
        }, {});
      } else {
        // TODO what if the edge isn't found?
      }
    });
  }

  if (attempt.jobs?.length) {
    attempt.jobs.forEach((job) => {
      const id = job.id || 'trigger';

      nodes[id] = {
        id,
        configuration: job.credential, // TODO runtime needs to support string credentials
        expression: job.body,
        adaptor: job.adaptor,
      };

      if (job.state) {
        // TODO this is likely to change
        nodes[id].data = job.state;
      }

      const next = edges
        .filter((e) => e.source_job_id === id)
        .reduce((obj, edge) => {
          // @ts-ignore
          obj[edge.target_job_id] = edge.condition
            ? { expression: edge.condition }
            : true;
          return obj;
        }, {});

      if (Object.keys(next).length) {
        nodes[id].next = next;
      }
    });
  }

  plan.jobs = Object.values(nodes);

  return plan as ExecutionPlan;
};
