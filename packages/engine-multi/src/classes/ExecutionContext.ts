import { EventEmitter } from 'node:events';

import type {
  WorkflowState,
  CallWorker,
  ExecutionContextConstructor,
  ExecutionContextOptions,
} from '../types';
import type { Logger } from '@openfn/logger';
import loadVersions from '../util/load-versions';

/**
 * The ExeuctionContext class wraps an event emitter with some useful context
 * and automatically appends the workflow id to each emitted events
 *
 * Each running workflow has its own context object
 */

// TODO could use some explicit unit tests on this
export default class ExecutionContext extends EventEmitter {
  state: WorkflowState;
  logger: Logger;
  callWorker: CallWorker;
  options: ExecutionContextOptions;
  versions = {};

  constructor({
    state,
    logger,
    callWorker,
    options,
  }: ExecutionContextConstructor) {
    super();
    this.logger = logger;
    this.callWorker = callWorker;
    this.state = state;
    this.options = options;
    this.versions = loadVersions();
  }

  // override emit to add the workflowId to all events
  // @ts-ignore
  emit(event: string, payload: any) {
    payload.workflowId = this.state.id;
    return super.emit(event, payload);
  }
}
