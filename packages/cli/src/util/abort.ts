import { Logger } from '@openfn/logger';

class AbortError extends Error {
  constructor(reason: string) {
    super(reason);
  }
  handled = true;
}

// This is always the CLI logger, can I trap it?
export default (
  logger: Logger,
  reason: string,
  error?: Error,
  help?: string
) => {
  const e = new AbortError(reason);
  logger.break();
  logger.error(reason);
  if (error) {
    logger.error(error.message);
  }
  if (help) {
    logger.always(help);
  }
  logger.break();
  logger.error('Critical error: aborting command');

  process.exitCode = 1;

  throw e;
};
