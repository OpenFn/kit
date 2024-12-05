import { writeFile } from 'node:fs/promises';

import { Logger } from '../util/logger';
import { CollectionsOptions } from './command';
import request from './request';

export const get = async (options: CollectionsOptions, logger: Logger) => {
  logger.info(
    `Fetching "${options.key}" from collection "${options.collectionName}"`
  );

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

export default {
  get,
};
