export type Job = {
  id?: string;
  name: string;
  adaptor: string;
  enabled?: boolean;
  body: string;
  delete?: boolean;
};

export type Trigger = {
  id?: string;
  type?: string;
  cron_expression?: string;
  delete?: boolean;
};

export type StateEdge = {
  id: string;
  condition: string | null;
  source_job_id: string | null;
  source_trigger_id: string | null;
  target_job_id: string;
};

export type SpecEdge = {
  condition: string | null;
  source_job?: string | null;
  source_trigger?: string | null;
  target_job: string | null;
};

export type WorkflowSpec = {
  id?: string;
  name: string;
  jobs?: Record<string | symbol, Job>;
  triggers?: Record<string | symbol, Trigger>;
  edges?: Record<string | symbol, SpecEdge>;
};

export interface ProjectSpec {
  name: string;
  description: string;
  workflows: Record<string | symbol, WorkflowSpec>;
}

export interface WorkflowState {
  id: string;
  name: string;
  jobs: Record<string | symbol, Concrete<Job>>;
  triggers: Record<string | symbol, Concrete<Trigger>>;
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
}

export interface ProjectPayload {
  id: string;
  name: string;
  description: string;
  workflows: {
    id: string;
    name: string;
    project_id?: string;
    jobs: Concrete<Job>[];
    triggers: Concrete<Trigger>[];
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
