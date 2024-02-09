import type { ExecutionPlan, Lazy, State } from '@openfn/lexicon';
import type {
  GetPlanReply,
  LightningPlan,
  LightningPlanOptions,
} from '@openfn/lexicon/lightning';
import type { Logger } from '@openfn/logger';

import { getWithReply } from '../util';
import convertRun from '../util/convert-lightning-plan';
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
    plan: ExecutionPlan;
    options: LightningPlanOptions;
    input: Lazy<State>;
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
          const { plan, options, input } = await loadRun(channel);
          logger.debug('converted run as execution plan:', plan);
          resolve({ channel, plan, options, input });
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
  const runBody = await getWithReply<GetPlanReply>(channel, GET_PLAN);
  // then we generate the execution plan
  return convertRun(runBody as LightningPlan);
}
