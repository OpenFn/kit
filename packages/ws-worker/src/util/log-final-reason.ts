import { timestamp } from '@openfn/logger';
import { Context, onJobLog } from '../api/execute';
import { ExitReason } from '../types';

export default async (context: Context, reason: ExitReason) => {
  const time = (timestamp() - BigInt(10e6)).toString();

  let message = `Run complete with status: ${reason.reason}`;
  if (reason.reason !== 'success') {
    message += `\n${reason.error_type}: ${reason.error_message || 'unknown'}`;
  }

  await onJobLog(context, {
    time,
    message: JSON.stringify([message]),
    level: 'info',
    name: 'R/T',
  });
};
