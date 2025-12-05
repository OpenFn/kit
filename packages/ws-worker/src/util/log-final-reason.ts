import { timestamp } from '@openfn/logger';
import { ExitReason } from '@openfn/lexicon/lightning';
import { Context, onJobLog } from '../api/execute';

export default async (context: Context, reason: ExitReason) => {
  const time = (timestamp() - BigInt(10e6)).toString();

  const statusMessage = `Run complete with status: ${reason.reason}`;

  await onJobLog(context, [{
    time,
    message: [statusMessage],
    level: 'info',
    name: 'R/T',
  }]);

  if (reason.reason !== 'success') {
    const errorMessage = `${reason.error_type}: ${
      reason.error_message || 'unknown'
    }`;
    await onJobLog(context, [{
      time,
      message: [errorMessage],
      level: 'info',
      name: 'R/T',
    }]);
  }
};
