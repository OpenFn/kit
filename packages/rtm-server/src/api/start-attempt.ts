import phx from 'phoenix-channels';
import convertAttempt from '../util/convert-attempt';
import { getWithReply } from '../util';
import { Attempt, Channel } from '../types';
import { ExecutionPlan } from '@openfn/runtime';
import { GET_ATTEMPT } from '../events';

// TODO what happens if this channel join fails?
// Lightning could vanish, channel could error on its side, or auth could be wrong
// We don't have a good feedback mechanism yet - attempts:queue is the only channel
// we can feedback to
// Maybe we need a general errors channel
const joinAttemptChannel = (
  socket: phx.Socket,
  token: string,
  attemptId: string
) => {
  return new Promise<{ channel: Channel; plan: ExecutionPlan }>(
    (resolve, reject) => {
      const channel = socket.channel(`attempt:${attemptId}`, { token });
      channel
        .join()
        .receive('ok', async () => {
          const plan = await loadAttempt(channel);
          resolve({ channel, plan });
        })
        .receive('error', (err) => {
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
