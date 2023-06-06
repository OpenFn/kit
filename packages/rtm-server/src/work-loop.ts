import tryWithBackoff from './util/try-with-backoff';
import { Attempt } from './types';

// TODO how does this report errors, like if Lightning is down?
// Or auth is bad?
export default (
  lightningUrl: string,
  rtmId: string,
  execute: (attempt: Attempt) => void
) => {
  const fetchWork = async () => {
    // TODO what if this retuns like a 500?  Server down?
    const result = await fetch(`${lightningUrl}/api/1/attempts/next`, {
      method: 'POST',
      body: JSON.stringify({ rtm_id: rtmId }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    if (result.body) {
      result.json().then((workflows) => {
        workflows.forEach(execute);
      });
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