import type { GetPlanReply, LightningPlan } from '@openfn/lexicon/lightning';
import * as Sentry from '@sentry/node';
import type { Logger } from '@openfn/logger';

import { getWithReply } from '../util';
import { GET_PLAN } from '../events';
import type { Channel, Socket } from '../types';

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
    run: LightningPlan;
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
          const run = await getWithReply<GetPlanReply>(channel, GET_PLAN);
          resolve({ channel, run });
        }
      })
      .receive('error', (err: any) => {
        Sentry.captureException(err);
        logger.error(`error connecting to ${channelName}`, err);
        reject(err);
      })
      .receive('timeout', (err: any) => {
        Sentry.captureException(err);
        logger.error(`Timeout for ${channelName}`, err);
        reject(err);
      });
    channel.onClose(() => {
      // channel was explicitly closed by the client or server
      logger.debug(`Leaving ${channelName}`);
    });
    channel.onError((e: any) => {
      // Error occurred on the channel
      // (the socket will try to reconnect with backoff)
      logger.debug(`Error in ${channelName}`);
      logger.debug(e);
    });
  });
};

export default joinRunChannel;
