export type StateJob = {
  id: string;
  name: string;
  adaptor: string;
  body: string;
  project_credential_id: string | null;
  delete?: boolean;
};

export type SpecJobBody =
  | string
  | {
      path?: string;
      content: string;
    };

export type SpecJob = {
  id?: string;
  name: string;
  adaptor: string;
  body: SpecJobBody;
  credential: string | null;
};

export type StateKafkaHost = [string, string];

export type StateKafkaConfiguration = {
  hosts: StateKafkaHost[];
  topics: string[];
  initial_offset_reset_policy: string;
  connect_timeout: number;
};

export type SpecKafkaConfiguration = {
  hosts: string[];
  topics: string[];
  initial_offset_reset_policy: string;
  connect_timeout: number;
};

export type SpecTrigger = {
  type: string;
  cron_expression?: string;
  enabled?: boolean;
  kafka_configuration?: SpecKafkaConfiguration;
};

export type StateTrigger = {
  id: string;
  type: string;
  cron_expression?: string;
  delete?: boolean;
  enabled?: boolean;
  kafka_configuration?: StateKafkaConfiguration;
};

export type StateEdge = {
  id: string;
  condition_type: string;
  condition_expression: string | null;
  condition_label: string | null;
  source_job_id: string | null;
  source_trigger_id: string | null;
  target_job_id: string;
  enabled?: boolean;
};

export type SpecEdge = {
  condition_type: string;
  condition_expression: string | null;
  condition_label: string | null;
  source_job?: string | null;
  source_trigger?: string | null;
  target_job: string | null;
  enabled?: boolean;
};

export type WorkflowSpec = {
  id?: string;
  name: string;
  jobs?: Record<string | symbol, SpecJob>;
  triggers?: Record<string | symbol, SpecTrigger>;
  edges?: Record<string | symbol, SpecEdge>;
};

export type CredentialSpec = {
  name: string;
  owner: string;
};

export type CredentialState = {
  id: string;
  name: string;
  owner: string;
};

export type CollectionSpec = {
  name: string;
};

export type CollectionState = {
  id: string;
  name: string;
  delete?: boolean;
};

export interface ProjectSpec {
  name: string;
  description: string;
  workflows: Record<string | symbol, WorkflowSpec>;
  credentials: Record<string | symbol, CredentialSpec>;
  collections: Record<string | symbol, CollectionSpec>;
}

export interface WorkflowState {
  id: string;
  name: string;
  jobs: Record<string | symbol, Concrete<StateJob>>;
  triggers: Record<string | symbol, Concrete<StateTrigger>>;
  edges: Record<string | symbol, Concrete<StateEdge>>;
  delete?: boolean;
  project_id?: string;

  inserted_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface ProjectState {
  id: string;
  name: string;
  description: string;
  workflows: Record<string | symbol, WorkflowState>;
  project_credentials: Record<string | symbol, CredentialState>;
  collections: Record<string | symbol, CollectionState>;
}

export interface ProjectPayload {
  id: string;
  name: string;
  description: string;
  collections?: Concrete<CollectionState>[];
  project_credentials: Concrete<CredentialState>[];
  workflows: {
    id: string;
    name: string;
    project_id?: string;
    jobs: Concrete<StateJob>[];
    triggers: Concrete<StateTrigger>[];
    edges: Concrete<StateEdge>[];
  }[];
}

type Concrete<Type> = Type & { id: string };

export interface DeployConfig {
  configPath?: string;
  specPath: string;
  statePath: string;
  endpoint: string;
  requireConfirmation: boolean;
  dryRun: boolean;
  apiKey: string | null;
}
