import { EventEmitter } from 'node:events';

import type { State, Job, Workflow } from '../types';

// A mock runtime manager
//

// TODO do we mean job, or workflow?
// I think we have both?
export type RTMEvent =
  | 'job-start'
  | 'job-end'
  | 'job-log'
  | 'job-error'
  | 'workflow-start'
  | 'workflow-end';

type FetchWorkflowFn = (workflowId: string) => Promise<Workflow>;

type FetchJobFn = (jobId: string) => Promise<Job>;

const mockFetchWorkflow = (workflowId: string) =>
  new Promise((resolve) => resolve({ job: 'job1', next: [] }));

const mockFetchJob = (jobId: string) =>
  new Promise<Job>((resolve) =>
    resolve({
      expression: 'export default [s => s];',
      state: {},
    })
  );

let id = 0;
const getNewJobId = () => ++id;

// The mock will need some kind of helper function to get from a queue
// This could call out to an endpoint or use something memory
// actually i don't think that's right
function createMock(
  fetchWorkflow = mockFetchWorkflow,
  fetchJob = mockFetchJob
) {
  const mockResults: Record<any, any> = {};

  // This at the moment is an aspirational API - its what I think we want

  const bus = new EventEmitter();

  const dispatch = (type: RTMEvent, args?: any) => {
    // TODO add performance metrics to every event?
    bus.emit(type, args);

    // TOOD return an unsubscribe API?
  };

  const on = (event: RTMEvent, fn: (evt: any) => void) => {
    bus.addListener(event, fn);
  };

  // who handles workflows?
  // a) we are given all the data about a workflow at once and we just chew through it
  //    (may not be possible?)
  // b) we call out to get the inputs to each workflow when we start
  //    But who do we call out to?
  //    Arch doc says lightning, but I need to decouple this here
  // Right now this is a string of job ids
  // A workflow isn't just an array btw, it's a graph
  // That does actually need thinking through
  // There's a jobID, which is what Lightning calls the job
  // And there's like an executionID or a runId, which is what the RTM calls the instance run
  // These ought to be UUIDs so they're unique across RTMs
  const startJob = (jobId: string) => {
    const runId = getNewJobId();

    // Get the job details from lightning
    fetchJob(jobId).then(() => {
      // start instantly and emit as it goes
      dispatch('job-start', { jobId, runId });

      // TODO random timeout
      // What is a job log? Anything emitted by the RTM I guess?
      // Namespaced to compile, r/t, job etc.
      // It's the json output of the logger
      dispatch('job-log', { jobId, runId });

      // TODO random timeout
      const finalState = mockResults.hasOwnProperty(jobId)
        ? mockResults[jobId]
        : {};
      dispatch('job-end', { jobId, runId, state: finalState });
    });

    return id;
  };

  const startWorkflow = (workflowId: string) => {
    // console.log('start-workflow', workflowId);
    // Get the execution plan from lightning
    dispatch('workflow-start', { workflowId });

    dispatch('workflow-end', { workflowId });
  };

  // return a list of jobs in progress
  const getStatus = () => {};

  const _setJobResult = (jobId: string, result: any) => {
    mockResults[jobId] = result;
  };

  return {
    on,
    // TODO runWorkflow? executeWorkflow?
    startWorkflow,
    startJob, // this is more of an internal API
    getStatus,

    // mock APIs
    _setJobResult,
  };
}

export default createMock;
