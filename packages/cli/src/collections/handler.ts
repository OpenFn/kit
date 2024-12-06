import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

import { Logger } from '../util/logger';
import request from './request';

import type { GetOptions, SetOptions } from './command';

export const get = async (options: GetOptions, logger: Logger) => {
  logger.info(
    `Fetching "${options.key}" from collection "${options.collectionName}"`
  );

  // TODO: log the output format
  // Something like: downloading single values item vs downloading multiple key/value pairs

  const result = await request(
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

  result.count = Object.keys(result.items).length;

  // TODO if fetching a single ite, (no pattern) return it verbatim

  logger.success(`Fetched ${result.count} items!`);

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
    logger.print(result.items);
  }
};

export const set = async (options: SetOptions, logger: Logger) => {
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
  console.log(items);
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
