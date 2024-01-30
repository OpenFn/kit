import convertRun from '../util/convert-run';
import { getWithReply } from '../util';
import { Run, RunOptions, Channel, Socket } from '../types';
import { ExecutionPlan } from '@openfn/runtime';
import { GET_RUN, GetRunReply } from '../events';

import type { Logger } from '@openfn/logger';

// TODO what happens if this channel join fails?
// Lightning could vanish, channel could error on its side, or auth could be wrong
// We don't have a good feedback mechanism yet - worker:queue is the only channel
// we can feedback to
// Maybe we need a general errors channel
const joinRunChannel = (
  socket: Socket,
  token: string,
  runId: string,
  logger: Logger
) => {
  return new Promise<{
    channel: Channel;
    plan: ExecutionPlan;
    options: RunOptions;
  }>((resolve, reject) => {
    // TMP - lightning seems to be sending two responses to me
    // just for now, I'm gonna gate the handling here
    let didReceiveOk = false;

    // TODO use proper logger
    const channelName = `run:${runId}`;
    logger.debug('connecting to ', channelName);
    const channel = socket.channel(channelName, { token });
    channel
      .join()
      .receive('ok', async (e: any) => {
        if (!didReceiveOk) {
          didReceiveOk = true;
          logger.success(`connected to ${channelName}`, e);
          const { plan, options } = await loadRun(channel);
          logger.debug('converted run as execution plan:', plan);
          resolve({ channel, plan, options });
        }
      })
      .receive('error', (err: any) => {
        logger.error(`error connecting to ${channelName}`, err);
        reject(err);
      });
  });
};

export default joinRunChannel;

export async function loadRun(channel: Channel) {
  // first we get the run body through the socket
  const runBody = await getWithReply<GetRunReply>(channel, GET_RUN);
  // then we generate the execution plan
  return convertRun(runBody as Run);
}
