// idk what to call this
// Does it count as part of the API?
// Is it a kind of middleware?
// Is it one of many RTM helpers?

import axios from 'axios';
import { tryWithBackoff } from './util';

// TODO how does this report errors, like if Lightning is down?
// Or auth is bad?
export default (lightningUrl: string, rtm: any) => {
  const fetchWork = async () => {
    // TODO what if this retuns like a 500?  Server down?
    const result = await axios.post(`${lightningUrl}/api/1/attempts/next`, {
      id: rtm.id,
    });
    if (result.data) {
      // TODO handle multiple attempts
      const [attempt] = result.data;
      // Start the job (but don't wtit for it)
      rtm.execute(attempt);

      // Return true t
      return true;
    }
    // return false to backoff and try again
    return false;
  };

  const workLoop = () => {
    tryWithBackoff(fetchWork)
      .then(workLoop)
      .catch(() => {
        // this means the backoff expired
        // which right now it won't ever do
        // but what's the plan?
        // log and try again I guess?
        workLoop();
      });
  };

  return workLoop();
  // maybe we can return an api like
  // { start, pause, on('error') }
};
