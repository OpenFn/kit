import { Channel } from '../types';

export default (channel: Channel, event: string, payload?: any) =>
  new Promise((resolve) => {
    channel.push(event, payload).receive('ok', (evt: any) => {
      resolve(evt);
    });
    // TODO handle errors and timeouts too
  });
