import convertAttempt from '../util/convert-attempt';
import { getWithReply } from '../util';
import { Attempt, Channel, Socket } from '../types';
import { ExecutionPlan } from '@openfn/runtime';
import { GET_ATTEMPT } from '../events';

import type { Logger } from '@openfn/logger';

// TODO what happens if this channel join fails?
// Lightning could vanish, channel could error on its side, or auth could be wrong
// We don't have a good feedback mechanism yet - worker:queue is the only channel
// we can feedback to
// Maybe we need a general errors channel
const joinAttemptChannel = (
  socket: Socket,
  token: string,
  attemptId: string,
  logger: Logger
) => {
  return new Promise<{ channel: Channel; plan: ExecutionPlan }>(
    (resolve, reject) => {
      // TMP - lightning seems to be sending two responses to me
      // just for now, I'm gonna gate the handling here
      let didReceiveOk = false;

      // TODO use proper logger
      const channelName = `attempt:${attemptId}`;
      logger.debug('connecting to ', channelName);
      const channel = socket.channel(channelName, { token });
      channel
        .join()
        .receive('ok', async (e: any) => {
          if (!didReceiveOk) {
            didReceiveOk = true;
            logger.success(`connected to ${channelName}`, e);
            const plan = await loadAttempt(channel);
            logger.debug('converted attempt as execution plan:', plan);
            resolve({ channel, plan });
          }
        })
        .receive('error', (err: any) => {
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
