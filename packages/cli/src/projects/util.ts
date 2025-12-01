import type { Opts } from '../options';
import type { Logger } from '@openfn/logger';

type AuthOptions = Pick<Opts, 'apiKey' | 'endpoint'>;

export const loadAppAuthConfig = (
  options: AuthOptions,
  logger: Logger
): Required<AuthOptions> => {
  const { OPENFN_API_KEY, OPENFN_ENDPOINT } = process.env;

  const config: AuthOptions = {
    apiKey: options.apiKey,
    endpoint: options.endpoint,
  };

  if (!options.apiKey && OPENFN_API_KEY) {
    logger.info('Using OPENFN_API_KEY environment variable');
    config.apiKey = OPENFN_API_KEY;
  }

  if (!options.endpoint && OPENFN_ENDPOINT) {
    logger.info('Using OPENFN_ENDPOINT environment variable');
    config.endpoint = OPENFN_ENDPOINT;
  }

  // TODO probably need to throw

  return config as Required<AuthOptions>;
};
