import crypto from 'crypto';
import { deepClone } from 'fast-json-patch';
import {
  CredentialState,
  ProjectPayload,
  ProjectSpec,
  ProjectState,
  SpecEdge,
  SpecJobBody,
  StateEdge,
  WorkflowSpec,
  WorkflowState,
} from './types';
import {
  isEmpty,
  pickKeys,
  splitZip,
  hyphenate,
  reduceByKey,
  assignIfTruthy,
} from './utils';
import { DeployError } from './deployError';
import { Logger } from '@openfn/logger/dist';

function stringifyJobBody(body: SpecJobBody): string {
  if (typeof body === 'object') {
    return body.content;
  } else {
    return body;
  }
}

function mergeJobs(
  credentials: ProjectState['project_credentials'],
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
            body: stringifyJobBody(specJob.body),
            project_credential_id:
              specJob.credential && credentials[specJob.credential]?.id,
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
            body: stringifyJobBody(specJob.body),
            project_credential_id:
              specJob.credential && credentials[specJob.credential]?.id,
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
  if (key in first) {
    return first[key];
  }

  if (key in second) {
    return second[key];
  }

  return defaultValue;
}

function mergeTriggers(
  stateTriggers: WorkflowState['triggers'],
  specTriggers: WorkflowSpec['triggers']
): WorkflowState['triggers'] {
  return Object.fromEntries(
    splitZip(stateTriggers, specTriggers!).map(
      ([triggerKey, stateTrigger, specTrigger]) => {
        if (specTrigger && !stateTrigger) {
          return [
            triggerKey,
            {
              id: crypto.randomUUID(),
              ...pickKeys(specTrigger, ['type', 'enabled']),
              ...(specTrigger.type === 'cron'
                ? { cron_expression: specTrigger.cron_expression }
                : {}),
            },
          ];
        }

        if (!specTrigger && stateTrigger) {
          return [triggerKey, { id: stateTrigger!.id, delete: true }];
        }

        // prefer spec, but use state if spec is missing, or default
        return [
          triggerKey,
          {
            id: stateTrigger!.id,
            ...{
              type: pickValue(specTrigger!, stateTrigger!, 'type', 'webhook'),
              enabled: pickValue(specTrigger!, stateTrigger!, 'enabled', true),
              ...(specTrigger!.type === 'cron'
                ? { cron_expression: specTrigger!.cron_expression }
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
          specEdge: SpecEdge,
          id: string
        ): StateEdge {
          const edge: StateEdge = assignIfTruthy(
            {
              id,
              condition_type: specEdge.condition_type ?? null,
              target_job_id: jobs[specEdge.target_job ?? -1]?.id ?? '',
              enabled: pickValue(specEdge, stateEdge || {}, 'enabled', true),
            },
            {
              condition_type: specEdge.condition_type,
              condition_expression: specEdge.condition_expression,
              condition_label: specEdge.condition_label,
              source_job_id: jobs[specEdge.source_job ?? -1]?.id,
              source_trigger_id: triggers[specEdge.source_trigger ?? -1]?.id,
            }
          );

          return edge;
        }

        if (specEdge && !stateEdge) {
          return [
            edgeKey,
            convertToStateEdge(jobs, triggers, specEdge, crypto.randomUUID()),
          ];
        }

        if (!specEdge && stateEdge) {
          return [edgeKey, { id: stateEdge.id, delete: true }];
        }

        return [
          edgeKey,
          convertToStateEdge(jobs, triggers, specEdge!, stateEdge!.id),
        ];
      }
    )
  );
}

// Prepare the next state, based on the current state and the spec.
export function mergeSpecIntoState(
  oldState: ProjectState,
  spec: ProjectSpec,
  logger?: Logger
): ProjectState {
  const nextCredentials = Object.fromEntries(
    splitZip(oldState.project_credentials || {}, spec.credentials || {}).map(
      ([credentialKey, stateCredential, specCredential]) => {
        if (specCredential && !stateCredential) {
          return [
            credentialKey,
            {
              id: crypto.randomUUID(),
              name: specCredential.name,
              owner: specCredential.owner,
            },
          ];
        }

        if (specCredential && stateCredential) {
          return [
            credentialKey,
            {
              id: stateCredential.id,
              name: specCredential.name,
              owner: specCredential.owner,
            },
          ];
        }

        throw new DeployError(
          `Invalid credential spec or corrupted state for credential: ${
            stateCredential?.name || specCredential?.name
          } (${stateCredential?.owner || specCredential?.owner})`,
          'VALIDATION_ERROR'
        );
      }
    )
  );

  const nextWorkflows = Object.fromEntries(
    splitZip(oldState.workflows, spec.workflows).map(
      ([workflowKey, stateWorkflow, specWorkflow]) => {
        const nextJobs = mergeJobs(
          nextCredentials,
          stateWorkflow?.jobs || {},
          specWorkflow?.jobs || {}
        );

        const nextTriggers = mergeTriggers(
          stateWorkflow?.triggers || {},
          specWorkflow?.triggers || {}
        );

        const nextEdges = mergeEdges(
          deepClone({ jobs: nextJobs, triggers: nextTriggers }),
          stateWorkflow?.edges || {},
          specWorkflow?.edges || {}
        );

        if (specWorkflow && isEmpty(stateWorkflow || {})) {
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

        if (!specWorkflow && !isEmpty(stateWorkflow || {})) {
          logger?.error('Critical error! Cannot continue');
          logger?.error(
            'Workflow found in project state but not spec:',
            stateWorkflow?.name
              ? `${stateWorkflow.name} (${stateWorkflow?.id})`
              : stateWorkflow?.id
          );
          process.exit(1);
        }

        return [
          workflowKey,
          {
            ...stateWorkflow,
            id: stateWorkflow!.id,
            name: specWorkflow!.name,
            jobs: nextJobs,
            triggers: nextTriggers,
            edges: nextEdges,
          },
        ];
      }
    )
  );

  const projectState: Partial<ProjectState> = {
    ...oldState,
    id: oldState.id || crypto.randomUUID(),
    name: spec.name,
    workflows: nextWorkflows,
    project_credentials: nextCredentials,
  };

  if (spec.description) projectState.description = spec.description;

  return projectState as ProjectState;
}

export function getStateFromProjectPayload(
  project: ProjectPayload
): ProjectState {
  const workflows = reduceByKey('name', project.workflows, (wf) => {
    const { triggers, jobs, edges, ...workflowData } = wf;
    const stateWorkflow = {
      ...workflowData,
    } as Partial<WorkflowState>;

    stateWorkflow.triggers = reduceByKey('type', wf.triggers!);
    stateWorkflow.jobs = reduceByKey('name', wf.jobs);
    stateWorkflow.edges = wf.edges.reduce((obj, edge) => {
      let sourceName;
      if (edge.source_trigger_id) {
        const t = wf.triggers.find((t) => t.id === edge.source_trigger_id)!;
        sourceName = t.type;
      } else {
        const job = wf.jobs.find((e) => e.id === edge.source_job_id)!;
        sourceName = job.name;
      }
      const target = wf.jobs.find((j) => j.id === edge.target_job_id)!;

      const name = hyphenate(`${sourceName}->${hyphenate(target.name)}`);
      obj[name] = edge;
      return obj;
    }, {} as Record<string, StateEdge>);

    return stateWorkflow as WorkflowState;
  });

  const project_credentials = (project.project_credentials || []).reduce(
    (acc, credential) => {
      const key = hyphenate(`${credential.owner} ${credential.name}`);
      acc[key] = credential;
      return acc;
    },
    {} as Record<string, CredentialState>
  );

  return {
    ...project,
    project_credentials,
    workflows,
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
        const { id, name } = nextWorkflow;

        const jobs = Object.fromEntries(
          idKeyPairs(nextWorkflow.jobs, state.workflows[key].jobs).map(
            ([key, nextJob, _state]) => [key, nextJob]
          )
        );
        const triggers = Object.fromEntries(
          idKeyPairs(nextWorkflow.triggers, state.workflows[key].triggers).map(
            ([key, nextTrigger, _state]) => [key, nextTrigger]
          )
        );
        const edges = Object.fromEntries(
          idKeyPairs(nextWorkflow.edges, state.workflows[key].edges).map(
            ([key, nextEdge, _state]) => [key, nextEdge]
          )
        );

        return [
          key,
          {
            ...nextWorkflow,
            id,
            name,
            jobs,
            triggers,
            edges,
          },
        ];
      }
    )
  );

  const nextCredentials = Object.fromEntries(
    idKeyPairs(
      project.project_credentials || {},
      state.project_credentials || {}
    ).map(([key, nextCredential, _state]) => {
      return [key, nextCredential];
    })
  );

  return {
    ...project,
    project_credentials: nextCredentials,
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
    return {
      ...workflow,
      jobs: Object.values(workflow.jobs),
      triggers: Object.values(workflow.triggers),
      edges: Object.values(workflow.edges),
    };
  });

  const project_credentials: ProjectPayload['project_credentials'] =
    Object.values(state.project_credentials);

  return {
    ...state,
    project_credentials,
    workflows,
  };
}
