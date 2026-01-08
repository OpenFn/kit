import crypto from 'node:crypto';
import path from 'node:path';
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
import type { LogLevel } from '@openfn/logger';
import { LightningPlan, LightningEdge } from '@openfn/lexicon/lightning';
import { ExecuteOptions } from '@openfn/engine-multi';
import { getNameAndVersion } from '@openfn/runtime';

const mapTriggerEdgeCondition = (edge: LightningEdge) => {
  const { condition } = edge;
  // This handles cron triggers with undefined conditions and the 'always' string.
  if (condition === undefined || condition === 'always') return true;
  // Otherwise, we will return the condition and assume it's a valid JS expression.
  return condition;
};

// Options which relate to this execution but are not part of the plan
export type WorkerRunOptions = ExecuteOptions & {
  // Defaults to true - must be explicity false to stop dataclips being sent
  outputDataclips?: boolean;
  payloadLimitMb?: number;
  logPayloadLimitMb?: number;
  jobLogLevel?: LogLevel;
  timeoutRetryCount?: number;
  timeoutRetryDelay?: number;
  batchLogs?: boolean;
  batchInterval?: number;
  batchLimit?: number;
  eventTimeoutSeconds?: number;
};

type ConversionOptions = {
  collectionsVersion?: string;
  monorepoPath?: string;
};

export default (
  run: LightningPlan,
  options: ConversionOptions = {}
): { plan: ExecutionPlan; options: WorkerRunOptions; input: Lazy<State> } => {
  const { collectionsVersion, monorepoPath } = options;

  const appendLocalVersions = (job: Job) => {
    if (monorepoPath && job.adaptors!) {
      for (const adaptor of job.adaptors) {
        const { name, version } = getNameAndVersion(adaptor);
        if (monorepoPath && version === 'local') {
          const shortName = name.replace('@openfn/language-', '');
          const localPath = path.resolve(monorepoPath, 'packages', shortName);
          job.linker ??= {};
          job.linker[name] = {
            path: localPath,
            version: 'local',
          };
        }
      }
    }
    return job;
  };

  // This function will look at every step and decide whether the collections adaptor
  // should be added to the array
  const appendCollectionsAdaptor = (
    plan: ExecutionPlan,
    collectionsVersion: string = 'latest'
  ) => {
    let hasCollections;
    plan.workflow.steps.forEach((step) => {
      const job = step as Job;
      if (job.expression?.match(/(collections\.)/)) {
        hasCollections = true;
        if (
          !job.adaptors?.find((v) =>
            v.startsWith('@openfn/language-collections')
          )
        ) {
          job.adaptors ??= [];
          job.adaptors.push(
            `@openfn/language-collections@${collectionsVersion}`
          );
        }
      }
    });
    return hasCollections;
  };

  // Some options get mapped straight through to the runtime's workflow options
  const runtimeOpts: Omit<WorkflowOptions, 'timeout'> = {};

  // But some need to get passed down into the engine's options
  const engineOpts: WorkerRunOptions = {};
  if (run.options) {
    if ('run_timeout_ms' in run.options) {
      engineOpts.runTimeoutMs = run.options.run_timeout_ms;
    }
    if ('payload_limit_mb' in run.options) {
      engineOpts.payloadLimitMb = run.options.payload_limit_mb;
    }
    if ('log_payload_limit_mb' in run.options) {
      engineOpts.logPayloadLimitMb = run.options.log_payload_limit_mb as number;
    }
    if ('run_memory_limit_mb' in run.options) {
      engineOpts.memoryLimitMb = run.options.run_memory_limit_mb;
    }
    if ('sanitize' in run.options) {
      engineOpts.sanitize = run.options.sanitize;
    }
    if ('output_dataclips' in run.options) {
      engineOpts.outputDataclips = run.options.output_dataclips;
    }
    if ('job_log_level' in run.options) {
      engineOpts.jobLogLevel = run.options.job_log_level;
    }
  }

  let initialState;
  if (run.dataclip_id) {
    initialState = run.dataclip_id;
  }

  if (run.starting_node_id) {
    runtimeOpts.start = run.starting_node_id;
  }

  const nodes: Record<StepId, Step> = {};

  const edges: LightningEdge[] = run.edges ?? [];

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
        adaptors: step.adaptor ? [step.adaptor] : [],
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
        }, {} as Record<string, StepEdge>);

      if (Object.keys(next).length) {
        job.next = next;
      }

      nodes[id] = job;
    });
  }

  const plan: ExecutionPlan = {
    id: run.id,
    options: runtimeOpts,
    workflow: {
      // id: run.workflowId, // TODO: lightning does not send this
      // name: run.name, // TODO: lightning does not send this
      steps: Object.values(nodes),
    },
  };

  // only pass globals if it's a string
  if (run.globals && typeof run.globals === 'string')
    plan.workflow.globals = run.globals;

  if (run.name) {
    plan.workflow.name = run.name;
  }

  if (collectionsVersion) {
    const hasCollections = appendCollectionsAdaptor(
      plan as ExecutionPlan,
      collectionsVersion
    );
    if (hasCollections) {
      plan.workflow.credentials = {
        collections_token: true,
        collections_endpoint: true,
      };
    }
  }

  // Find any @local versions and set them up properly
  for (const step of plan.workflow.steps) {
    appendLocalVersions(step as Job);
  }

  return {
    plan: plan as ExecutionPlan,
    options: engineOpts,
    input: initialState || {},
  };
};
