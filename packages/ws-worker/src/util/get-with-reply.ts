import { Channel } from '../types';

export default <T = any>(channel: Channel, event: string, payload?: any) =>
  new Promise<T>((resolve) => {
    channel.push(event, payload).receive('ok', (evt: any) => {
      resolve(evt);
    });
    // TODO handle errors and timeouts too
  });
