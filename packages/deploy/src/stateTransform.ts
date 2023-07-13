import crypto from 'crypto';
import { deepClone } from 'fast-json-patch';
import {
  ProjectPayload,
  ProjectSpec,
  ProjectState,
  SpecEdge,
  StateEdge,
  WorkflowSpec,
  WorkflowState,
} from './types';
import { isEmpty, pickKeys, splitZip } from './utils';
import { DeployError } from './deployError';

function mergeJobs(
  stateJobs: WorkflowState['jobs'],
  specJobs: WorkflowSpec['jobs']
): WorkflowState['jobs'] {
  return Object.fromEntries(
    splitZip(stateJobs, specJobs || {}).map(([jobKey, stateJob, specJob]) => {
      if (specJob && !stateJob) {
        return [
          jobKey,
          {
            id: crypto.randomUUID(),
            name: specJob.name,
            adaptor: specJob.adaptor,
            body: specJob.body,
            enabled: pickValue(specJob, stateJob || {}, 'enabled', true),
          },
        ];
      }

      if (!specJob && stateJob) {
        return [jobKey, { id: stateJob.id, delete: true }];
      }

      if (specJob && stateJob) {
        return [
          jobKey,
          {
            id: stateJob.id,
            name: specJob.name,
            adaptor: specJob.adaptor,
            body: specJob.body,
            enabled: pickValue(specJob, stateJob, 'enabled', true),
          },
        ];
      }

      throw new DeployError(
        `Invalid job spec or corrupted state for job with key: ${String(
          jobKey
        )}`,
        'VALIDATION_ERROR'
      );
    })
  );
}

// Given two objects, find the value of a key in the first object, or the second
// object, falling back to a default value.
function pickValue(
  first: Record<string, any>,
  second: Record<string, any>,
  key: string,
  defaultValue: any
): any {
  if (typeof first[key] !== 'undefined') {
    return first[key];
  }

  if (second && typeof second[key] !== 'undefined') {
    return second[key];
  }

  return defaultValue;
}

function mergeTriggers(stateTriggers, specTriggers): WorkflowState['triggers'] {
  return Object.fromEntries(
    splitZip(stateTriggers, specTriggers).map(
      ([triggerKey, stateTrigger, specTrigger]) => {
        if (specTrigger && !stateTrigger) {
          return [
            triggerKey,
            {
              id: crypto.randomUUID(),
              ...pickKeys(specTrigger, ['type']),
              ...(specTrigger.type === 'cron'
                ? { cron_expression: specTrigger.cron_expression }
                : {}),
            },
          ];
        }

        if (!specTrigger && stateTrigger) {
          return [
            triggerKey,
            { ...pickKeys(stateTrigger, ['id']), delete: true },
          ];
        }

        // prefer spec, but use state if spec is missing, or default
        return [
          triggerKey,
          {
            id: stateTrigger.id,
            ...{
              type: pickValue(specTrigger, stateTrigger, 'type', 'webhook'),
              ...(specTrigger.type === 'cron'
                ? { cron_expression: specTrigger.cron_expression }
                : {}),
            },
          },
        ];
      }
    )
  );
}

function mergeEdges(
  { jobs, triggers }: Pick<WorkflowState, 'jobs' | 'triggers'>,
  stateEdges: WorkflowState['edges'],
  specEdges: WorkflowSpec['edges']
): WorkflowState['edges'] {
  return Object.fromEntries(
    splitZip(stateEdges, specEdges || {}).map(
      ([edgeKey, stateEdge, specEdge]) => {
        // build a 'new edge', based off the spec and existing jobs and triggers
        function convertToStateEdge(
          jobs: WorkflowState['jobs'],
          triggers: WorkflowState['triggers'],
          specEdge: SpecEdge
        ): StateEdge {
          let edge: StateEdge = {
            condition: specEdge.condition || null,
            source_job_id: specEdge.source_job
              ? jobs[specEdge.source_job].id
              : null,
            source_trigger_id: specEdge.source_trigger
              ? triggers[specEdge.source_trigger].id
              : null,
            target_job_id: specEdge.target_job
              ? jobs[specEdge.target_job].id
              : null,
          };

          return edge;
        }

        if (specEdge && !stateEdge) {
          return [
            edgeKey,
            {
              ...convertToStateEdge(jobs, triggers, specEdge),
              id: crypto.randomUUID(),
            },
          ];
        }

        if (!specEdge && stateEdge) {
          return [edgeKey, { ...pickKeys(stateEdge, ['id']), delete: true }];
        }

        return [
          edgeKey,
          {
            ...convertToStateEdge(jobs, triggers, specEdge!),
            id: stateEdge!.id,
          },
        ];
      }
    )
  );
}

// Prepare the next state, based on the current state and the spec.
export function mergeSpecIntoState(
  oldState: ProjectState,
  spec: ProjectSpec
): ProjectState {
  const nextWorkflows = Object.fromEntries(
    splitZip(oldState.workflows, spec.workflows).map(
      ([workflowKey, stateWorkflow, specWorkflow]) => {
        stateWorkflow = stateWorkflow || {};

        const nextJobs = mergeJobs(
          stateWorkflow.jobs || {},
          specWorkflow?.jobs || {}
        );

        const nextTriggers = mergeTriggers(
          stateWorkflow.triggers || {},
          specWorkflow?.triggers || {}
        );

        const nextEdges = mergeEdges(
          deepClone({ jobs: nextJobs, triggers: nextTriggers }),
          stateWorkflow.edges || {},
          specWorkflow?.edges || {}
        );

        if (specWorkflow && isEmpty(stateWorkflow)) {
          return [
            workflowKey,
            {
              id: crypto.randomUUID(),
              name: specWorkflow.name,
              jobs: nextJobs,
              triggers: nextTriggers,
              edges: nextEdges,
            },
          ];
        }

        return [
          workflowKey,
          {
            ...stateWorkflow,
            id: stateWorkflow.id,
            name: specWorkflow.name,
            jobs: nextJobs,
            triggers: nextTriggers,
            edges: nextEdges,
          },
        ];
      }
    )
  );

  return {
    ...oldState,
    id: oldState.id || crypto.randomUUID(),
    name: spec.name,
    description: spec.description,
    workflows: nextWorkflows,
  };
}

// Maps the server response to the state, merging the two together.
// The state object is keyed by strings, while the server response is a
// list of objects.
export function mergeProjectPayloadIntoState(
  state: ProjectState,
  project: ProjectPayload
): ProjectState {
  // TODO: should be raise an error if either the state or the server response
  // doesn't match? and/or when the server response is missing an item?

  const nextWorkflows = Object.fromEntries(
    idKeyPairs(project.workflows, state.workflows).map(
      ([key, nextWorkflow, _state]) => {
        nextWorkflow.jobs = Object.fromEntries(
          idKeyPairs(nextWorkflow.jobs, state.workflows[key].jobs).map(
            ([key, nextJob, _state]) => [key, nextJob]
          )
        );

        nextWorkflow.triggers = Object.fromEntries(
          idKeyPairs(nextWorkflow.triggers, state.workflows[key].triggers).map(
            ([key, nextTrigger, _state]) => [key, nextTrigger]
          )
        );

        nextWorkflow.edges = Object.fromEntries(
          idKeyPairs(nextWorkflow.edges, state.workflows[key].edges).map(
            ([key, nextEdge, _state]) => [key, nextEdge]
          )
        );

        return [key, nextWorkflow];
      }
    )
  );

  return {
    ...project,
    workflows: nextWorkflows,
  };
}

function idKeyPairs<P extends { id: string }, S extends { id: string }>(
  projectItems: P[],
  stateItems: Record<keyof S, S>
): [key: string, projectItem: P, stateItem: S][] {
  let pairs: [string, P, S][] = [];
  for (const projectItem of projectItems) {
    for (const [key, stateItem] of Object.entries(stateItems)) {
      if (projectItem.id === stateItem.id) {
        pairs.push([key, projectItem, stateItem]);
      }
    }
  }

  return pairs;
}

export function toProjectPayload(state: ProjectState): ProjectPayload {
  // convert the state into a payload that can be sent to the server
  // the server expects lists of jobs, triggers, and edges, so we need to
  // convert the keyed objects into lists.

  const workflows: ProjectPayload['workflows'] = Object.values(
    state.workflows
  ).map((workflow) => {
    console.log(workflow);

    return {
      ...workflow,
      jobs: Object.values(
        workflow.jobs
      ) as ProjectPayload['workflows'][0]['jobs'],
      triggers: Object.values(
        workflow.triggers
      ) as ProjectPayload['workflows'][0]['triggers'],
      edges: Object.values(
        workflow.edges
      ) as ProjectPayload['workflows'][0]['edges'],
    };
  });

  return {
    ...state,
    workflows,
  };
}
