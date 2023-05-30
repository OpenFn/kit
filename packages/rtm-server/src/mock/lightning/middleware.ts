import Koa from 'koa';
import type { ServerState } from './server';
import { AttemptCompleteBody } from './api';

export const unimplemented = (ctx: Koa.Context) => {
  ctx.status = 501;
};

export const createFetchNextJob =
  (state: ServerState) => (ctx: Koa.Context) => {
    const { queue } = state;
    const { body } = ctx.request;
    if (!body || !body.rtm_id) {
      ctx.status = 400;
      return;
    }
    const countRaw = ctx.request.query.count as unknown;
    let count = 1;
    if (countRaw) {
      if (!isNaN(countRaw)) {
        count = countRaw as number;
      } else {
        console.error('Failed to parse parameter countRaw');
      }
    }
    const payload = [];

    while (count > 0 && queue.length) {
      // TODO assign the worker id to the attempt
      // Not needed by the mocks at the moment
      payload.push(queue.shift());
      count -= 1;
    }
    if (payload.length > 0) {
      ctx.body = JSON.stringify(payload);
      ctx.status = 200;
    } else {
      ctx.body = undefined;
      ctx.status = 204;
    }
  };

export const createGetCredential =
  (state: ServerState) => (ctx: Koa.Context) => {
    const { credentials } = state;
    const cred = credentials[ctx.params.id];
    if (cred) {
      ctx.body = JSON.stringify(cred);
      ctx.status = 200;
    } else {
      ctx.status = 404;
    }
  };

export const createNotify = (state: ServerState) => (ctx: Koa.Context) => {
  const { events } = state;
  const { event: name, ...payload } = ctx.request.body;

  const event = {
    id: ctx.params.id,
    name,
    ...payload, // spread payload?
  };

  events.emit('notify', event);

  ctx.status = 200;
};

export const createComplete =
  (state: ServerState) =>
  (
    ctx: Koa.ParameterizedContext<
      Koa.DefaultState,
      Koa.DefaultContext,
      AttemptCompleteBody
    >
  ) => {
    const { results, events } = state;
    const { state: resultState, rtm_id } = ctx.request.body;

    if (results[ctx.params.id] && results[ctx.params.id].rtmId === rtm_id) {
      results[ctx.params.id].state = resultState;

      events.emit('workflow-complete', {
        rtm_id,
        workflow_id: ctx.params.id,
        state: resultState,
      });

      ctx.status = 200;
    } else {
      // Unexpected result
      ctx.status = 400;
    }
  };
