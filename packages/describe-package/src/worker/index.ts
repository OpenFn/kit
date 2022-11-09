/**
 * Worker Entrypoint for using the compiler
 *
 * This module isn't intended to be used directly (without compilation).
 * A plugin for esbuild compiles the internals (`./worker.ts`) first and then
 * we import that as a string to provide a single all in one module for using
 * the compiler in either the browser or in Node.
 */

// @ts-ignore
import workerInternals from '../../dist/worker-internals.js?raw';
import { WorkerAPI } from './worker';
import { spawn, BlobWorker } from 'threads';

export function startWorker() {
  return spawn<WorkerAPI>(BlobWorker.fromText(workerInternals));
}
