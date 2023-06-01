import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'node:events';
import workerpool from 'workerpool';
import { ExecutionPlan } from '@openfn/runtime';

// import * as e from './events';
// import createAutoinstall from './runners/autoinstall';
import createCompile from './runners/compile';
import createExecute from './runners/execute';
import createLogger, { Logger } from '@openfn/logger';

export type State = any; // TODO I want a nice state def with generics

// Archive of every workflow we've run
// Fine to just keep in memory for now
type WorkflowStats = {
  id: string;
  name?: string; // TODO what is name? this is irrelevant?
  status: 'pending' | 'done' | 'err';
  startTime?: number;
  threadId?: number;
  duration?: number;
  error?: string;
  result?: any; // State
  plan: ExecutionPlan;
};

type Resolver<T> = (id: string) => Promise<T>;

// A list of helper functions which basically resolve ids into JSON
// to lazy load assets
export type LazyResolvers = {
  credentials?: Resolver<Credential>;
  state?: Resolver<State>;
  expressions?: Resolver<string>;
};

type RTMOptions = {
  resolvers: LazyResolvers;
  logger: Logger;
  useMock: false;
  repoDir: string;
};

const createRTM = function (serverId?: string, options: RTMOptions = {}) {
  const { resolvers, useMock } = options;
  let { repoDir } = options;

  const id = serverId || crypto.randomUUID();
  const logger = options.logger || createLogger('RTM', { level: 'debug' });

  const allWorkflows: Map<string, WorkflowStats> = new Map();
  const activeWorkflows: string[] = [];

  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const p = path.resolve(dirname, useMock ? './mock-worker.js' : './worker.js');
  const workers = workerpool.pool(p);

  const events = new EventEmitter();

  if (!repoDir) {
    repoDir = '/tmp/openfn/repo';
    logger.info('Defaulting repoDir to ', repoDir);
  }

  const onWorkflowStarted = (workflowId: string, threadId: number) => {
    logger.info('starting workflow ', workflowId);

    const workflow = allWorkflows.get(workflowId)!;
    if (workflow.startTime) {
      // TODO this shouldn't throw.. but what do we do?
      // We shouldn't run a workflow that's been run
      // Every workflow should have a unique id
      // maybe the RTM doesn't care about this
      throw new Error(`Workflow with id ${workflowId} is already started`);
    }
    workflow.startTime = new Date().getTime();
    workflow.duration = -1;
    workflow.threadId = threadId;
    activeWorkflows.push(workflowId);
  };

  const completeWorkflow = (workflowId: string, state: any) => {
    logger.success('complete workflow ', workflowId);
    logger.info(state);
    if (!allWorkflows.has(workflowId)) {
      throw new Error(`Workflow with id ${workflowId} is not defined`);
    }
    const workflow = allWorkflows.get(workflowId)!;
    workflow.status = 'done';
    workflow.result = state;
    workflow.duration = new Date().getTime() - workflow.startTime;
    const idx = activeWorkflows.findIndex((id) => id === workflowId);
    activeWorkflows.splice(idx, 1);
  };

  // Create "runner" functions for execute and compile
  const execute = createExecute(workers, repoDir, logger, {
    start: onWorkflowStarted,
  });
  const compile = createCompile(logger, repoDir);

  // How much of this happens inside the worker?
  // Shoud the main thread handle compilation? Has to if we want to cache
  // Unless we create a dedicated compiler worker
  // TODO error handling, timeout
  const handleExecute = async (plan: ExecutionPlan) => {
    logger.debug('Executing workflow ', plan.id);

    allWorkflows.set(plan.id, {
      id: plan.id,
      name: plan.name,
      status: 'pending',
      plan,
    });

    // TODO autoinstall

    const compiledPlan = await compile(plan);
    logger.debug('workflow compiled ', plan.id);
    const result = await execute(compiledPlan);
    logger.success(result);
    completeWorkflow(plan.id!, result);

    logger.debug('finished executing workflow ', plan.id);
    // Return the result
    // Note that the mock doesn't behave like ths
    // And tbf I don't think we should keep the promise open - there's no point?
    return result;
  };

  // const getActiveJobs = (): WorkflowStats[] => {
  //   const jobs = allWorkflows.map((id) => workflowList.get(id));
  //   return jobs.filter((j) => j) as WorkflowStats[]; // no-op for typings
  // };

  // const getCompletedJobs = (): WorkflowStats[] => {
  //   return Array.from(allWorkflows.values()).filter((workflow) => workflow.status === 'done');
  // };

  // const getErroredJobs = (): WorkflowStats[] => {
  //   return Array.from(workflowsList.values()).filter((workflow) => workflow.status === 'err');
  // };

  return {
    id,
    on: events.on,
    once: events.once,
    execute: handleExecute,
    // getStatus, // no tests on this yet, not sure if I want to commit to it

    // getActiveJobs,
    // getCompletedJobs,
    // getErroredJobs,
  };
};

export default createRTM;
