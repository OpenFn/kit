import type { GetPlanReply, LightningPlan } from '@openfn/lexicon/lightning';
import * as Sentry from '@sentry/node';
import type { Logger } from '@openfn/logger';

import { sendEvent } from '../util';
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
  logger: Logger,
  timeout: number = 30
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
    logger.info(`JOINING ${channelName}`);
    logger.debug(`connecting to ${channelName} with timeout ${timeout}s`);
    const channel = socket.channel(channelName, { token });
    channel
      .join(timeout * 1000)
      .receive('ok', async (e: any) => {
        if (!didReceiveOk) {
          didReceiveOk = true;
          logger.success(`connected to ${channelName}`, e);
          const run = await sendEvent<GetPlanReply>(
            { channel, logger, id: runId, options: {} },
            GET_PLAN
          );
          resolve({ channel, run });
        }
      })
      .receive('error', (err: any) => {
        Sentry.captureException(err);
        logger.error(`error connecting to ${channelName}`, err);
        channel?.leave();
        reject(err);
      })
      .receive('timeout', (err: any) => {
        Sentry.captureException(err);
        logger.error(`Timeout for ${channelName}`, err);
        channel?.leave();
        reject(err);
      });
    channel.onClose(() => {
      // channel was explicitly closed by the client or server
      logger.debug(`Leaving ${channelName}`);
    });
    channel.onError((...args: any) => {
      // Error occurred on the channel
      // (the socket will try to reconnect with backoff)
      logger.debug(`Critical error in channel ${channelName}`, args);
    });
  });
};

export default joinRunChannel;
