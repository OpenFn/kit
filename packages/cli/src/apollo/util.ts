import type { Logger } from '@openfn/logger';
import { ApolloOptions } from './handler';

export const PRODUCTION_URL = 'https://apollo.openfn.org';

//export const STAGING_URL = 'https://apollo-staging.openfn.org';
export const STAGING_URL = 'http://34.95.82.109'; // use direct ip for now

export const LOCAL_URL = 'http://localhost:3000';

const urlMap: Record<string, string> = {
  ['prod']: PRODUCTION_URL,
  ['production']: PRODUCTION_URL,
  ['staging']: STAGING_URL,
  ['local']: LOCAL_URL,
};

// this is the env we use by default
const DEFAULT_ENV = 'staging';

export const getURL = (options: ApolloOptions) => {
  if (options.apolloUrl) {
    if (options.apolloUrl in urlMap) {
      return urlMap[options.apolloUrl];
    }
    if (options.apolloUrl.startsWith('http')) {
      return options.apolloUrl;
    }
    throw new Error(`Unrecognised apollo URL`);
  }

  const userDefault = process.env.OPENFN_APOLLO_DEFAULT_ENV || DEFAULT_ENV;
  if (!/^(staging|prod|production|local|http*)$/.test(userDefault)) {
    throw new Error(`Unrecognised apollo URL loaded from env: ${userDefault}`);
  }

  return urlMap[userDefault || 'staging'];
};

// nicely print a bunch of files to std out
export const outputFiles = (files: Record<string, string>, logger: Logger) => {
  logger.print();
  for (const k in files) {
    const line = new Array(k.length + 1).fill('-').join('');
    logger.print(line);
    logger.print(`${k}`);
    logger.print(line);
    logger.print();
    logger.print(files[k]);
    logger.print();
    logger.print();
  }
};
