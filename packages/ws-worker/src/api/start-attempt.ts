import phx from 'phoenix-channels';

import convertAttempt from '../util/convert-attempt';
import { getWithReply } from '../util';
import { Attempt, Channel } from '../types';
import { ExecutionPlan } from '@openfn/runtime';
import { GET_ATTEMPT } from '../events';

import type { Logger } from '@openfn/logger';

// TODO what happens if this channel join fails?
// Lightning could vanish, channel could error on its side, or auth could be wrong
// We don't have a good feedback mechanism yet - attempts:queue is the only channel
// we can feedback to
// Maybe we need a general errors channel
const joinAttemptChannel = (
  socket: phx.Socket,
  token: string,
  attemptId: string,
  logger: Logger
) => {
  return new Promise<{ channel: Channel; plan: ExecutionPlan }>(
    (resolve, reject) => {
      // TODO use proper logger
      const channelName = `attempt:${attemptId}`;
      logger.debug('connecting to ', channelName);
      const channel = socket.channel(channelName, { token });
      channel
        .join()
        .receive('ok', async () => {
          logger.success(`connected to ${channelName}`);
          const plan = await loadAttempt(channel);
          logger.debug('converted attempt as execution plan:', plan);
          resolve({ channel, plan });
        })
        .receive('error', (err) => {
          logger.error(`error connecting to ${channelName}`, err);
          reject(err);
        });
    }
  );
};

export default joinAttemptChannel;

export async function loadAttempt(channel: Channel) {
  // first we get the attempt body through the socket
  const attemptBody = await getWithReply(channel, GET_ATTEMPT);
  // then we generate the execution plan
  const plan = convertAttempt(attemptBody as Attempt);
  return plan;
}
