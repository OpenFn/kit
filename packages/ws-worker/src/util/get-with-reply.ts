import { Channel } from '../types';

export default <T = any>(channel: Channel, event: string, payload?: any) =>
  new Promise<T>((resolve, reject) => {
    channel
      .push(event, payload)
      .receive('ok', (evt: any) => {
        resolve(evt);
      })
      .receive('error', (e: any) => {
        reject(e);
      })
      .receive('timeout', (e: any) => {
        reject(e);
      });
  });
