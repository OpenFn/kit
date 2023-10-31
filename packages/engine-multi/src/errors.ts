// This will eventually contain all the error classes thrown by the engine
import { Promise as WorkerPoolPromise } from 'workerpool';

// Thrown when the whole workflow is timedout
export const TimeoutError = WorkerPoolPromise.TimeoutError;
