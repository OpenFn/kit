import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

import { Logger } from '../util/logger';
import request from './request';

import type { CollectionsOptions, GetOptions, SetOptions } from './command';

const ensureToken = (opts: CollectionsOptions, logger: Logger) => {
  if (!('token' in opts)) {
    if (process.env.OPENFN_PAT) {
      const token = process.env.OPENFN_PAT;
      logger.info(
        `Using access token ending in ${token?.substring(
          token.length - 10
        )} from env (OPENFN_PAT)`
      );
      opts.token = token;
    } else {
      logger.error('No access token detected!');
      logger.error(
        'Ensure you pass a Personal Access Token (PAT) with --token $MY_TOKEN or set the OPENFN_PAT env var'
      );
      logger.error(
        'You can get a PAT from OpenFn, see https://docs.openfn.org/documentation/api-tokens'
      );

      throw new Error('NO_PAT');
    }
  }
};

export const get = async (options: GetOptions, logger: Logger) => {
  ensureToken(options, logger);
  const multiMode = options.key.includes('*');
  if (multiMode) {
    logger.info(
      `Fetching multiple items from collection "${options.collectionName}" with pattern ${options.key}`
    );
  } else {
    logger.info(
      `Fetching "${options.key}" from collection "${options.collectionName}"`
    );
  }

  let result = await request(
    'GET',
    {
      lightning: options.lightning,
      token: options.token,
      pageSize: options.pageSize,
      limit: options.limit,
      key: options.key,
      collectionName: options.collectionName,
    },
    logger
  );

  if (multiMode) {
    result.count = Object.keys(result.items).length;
    logger.success(`Fetched ${result.count} items!`);
  } else {
    result = Object.values(result.items)[0];
    logger.success(`Fetched ${options.key}`);
  }

  if (options.outputPath) {
    const content = JSON.stringify(
      result,
      null,
      options.pretty ? 2 : undefined
    );
    await writeFile(options.outputPath!, content);
    logger.always(`Wrote items to ${options.outputPath}`);
  } else {
    // use print because it won't stringify
    logger.print(multiMode ? result.items : result);
  }
};

export const set = async (options: SetOptions, logger: Logger) => {
  ensureToken(options, logger);
  logger.info(`Upserting items to collection "${options.collectionName}"`);

  // Array of key/value pairs to upsert
  const items = [];

  // set multiple items
  if (options.items) {
    const resolvedPath = path.resolve(options.items);
    logger.debug('Loading items from ', resolvedPath);
    const data = await readFile(resolvedPath, 'utf8');
    const obj = JSON.parse(data);

    Object.entries(obj).forEach(([key, value]) => {
      items.push({ key, value: JSON.stringify(value) });
    });

    logger.info(`Upserting ${items.length} items`);
  } else if (options.key && options.value) {
    const resolvedPath = path.resolve(options.value);
    logger.debug('Loading value from ', resolvedPath);
    // TODO throw if key contains a *

    // set a single item
    const data = await readFile(path.resolve(options.value), 'utf8');
    // Ensure the data is properly jsonified
    const value = JSON.stringify(JSON.parse(data));

    items.push({ key: options.key, value });
    logger.info(`Upserting data to "${options.key}"`);
  } else {
    // throw for invalid arguments
    throw new Error('INVALID_ARGUMENTS');
  }

  // get the input data
  const result = await request(
    'POST',
    {
      lightning: options.lightning,
      token: options.token,
      key: options.key,
      collectionName: options.collectionName,
      data: { items },
    },
    logger
  );

  logger.success(`Upserted ${result.upserted} items!`);
};

export default {
  get,
  set,
};
