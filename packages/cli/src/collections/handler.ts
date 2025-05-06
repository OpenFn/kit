import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

import { Logger } from '../util/logger';
import request from './request';

import type {
  CollectionsOptions,
  GetOptions,
  RemoveOptions,
  SetOptions,
} from './command';
import { throwAbortableError } from '../util/abort';
import { QueryOptions } from '@openfn/language-collections/types/collections';
import { parseGoogleSheet } from '../util/google-sheet-parser';

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

const buildQuery = (options: any) => {
  const map: Record<keyof QueryOptions, string> = {
    createdBefore: 'created_before',
    createdAfter: 'created_after',
    updatedBefore: 'updated_before',
    updatedAfter: 'updated_after',
  };
  const query: any = {};
  Object.keys(map).forEach((key) => {
    if (options[key]) {
      query[map[key]] = options[key];
    }
  });
  return query;
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
      token: options.token!,
      pageSize: options.pageSize,
      limit: options.limit,
      key: options.key,
      collectionName: options.collectionName,
      query: buildQuery(options),
    },
    logger
  );

  if (multiMode) {
    logger.success(`Fetched ${Object.keys(result).length} items!`);
  } else {
    result = Object.values(result)[0];
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
    logger.print(result);
  }
};

export const set = async (options: SetOptions, logger: Logger) => {
  if (options.key && options.items) {
    throwAbortableError(
      'ARGUMENT_ERROR: arguments for key and items were provided',
      'If upserting multiple items with --items, do not pass a key'
    );
  }

  if (options.sheet && options.items) {
    throwAbortableError(
      'ARGUMENT_ERROR: arguments for sheet and items were provided',
      'You can only pass one of --sheet or --items'
    );
  }

  ensureToken(options, logger);
  logger.info(`Upserting items to collection "${options.collectionName}"`);

  // Array of key/value pairs to upsert
  const items: Array<{ key: string; value: string }> = [];

  // 1. Set multiple items from a JSON file.
  if (options.items) {
    const resolvedPath = path.resolve(options.items);
    logger.debug('Loading items from ', resolvedPath);
    const data = await readFile(resolvedPath, 'utf8');
    const obj = JSON.parse(data);

    Object.entries(obj).forEach(([key, value]) => {
      items.push({ key, value: JSON.stringify(value) });
    });

    logger.info(`Upserting ${items.length} items`);
  }
  // 2. Set mapping from a Google Sheet.
  else if (options.sheet) {
    logger.info(
      `Upserting mapping from a Google Sheet to collection "${options.collectionName}"`
    );

    let mapping;
    try {
      // Call our parser to get the mapping from the public sheet.
      mapping = await parseGoogleSheet(options.sheet, {
        keyColumn: options.keyColumn ?? 0,
        valueColumn: options.valueColumn ?? 1,
        skipHeaders: options.skipHeaders !== false, // defaults to true
        worksheetName: options.worksheetName || 'Sheet1',
        nested: options.nested || false,
        // Optionally add a range option if needed
        range: options.range,
      });
    } catch (error) {
      logger.error('Error fetching Google Sheet:', error);
      throwAbortableError(
        'GOOGLE_SHEET_FETCH_ERROR',
        'Failed to fetch and parse the Google Sheet'
      );
    }
    // Push the mapping as a single key/value pair into the items array.
    items.push({ key: options.key, value: JSON.stringify(mapping) });
    logger.info(`Upserting mapping from Google Sheet as key "${options.key}"`);
  }
  // 3. Set a single item from a JSON file.
  else if (options.key && options.value) {
    const resolvedPath = path.resolve(options.value);
    logger.debug('Loading value from ', resolvedPath);

    // set a single item
    const data = await readFile(resolvedPath, 'utf8');
    // Ensure the data is properly jsonified
    const value = JSON.stringify(JSON.parse(data));

    items.push({ key: options.key, value });
    logger.info(`Upserting data to "${options.key}"`);
  } else {
    // throw for invalid arguments
    throw new Error('INVALID_ARGUMENTS');
  }

  // Upload the data to the OpenFn collections API.
  const result = await request(
    'POST',
    {
      lightning: options.lightning,
      token: options.token!,
      key: options.key,
      collectionName: options.collectionName,
      data: { items },
    },
    logger
  );

  logger.success(`Upserted ${result.upserted} items!`);
};

export const remove = async (options: RemoveOptions, logger: Logger) => {
  ensureToken(options, logger);
  logger.info(
    `Removing "${options.key}" from collection "${options.collectionName}"`
  );

  if (options.dryRun) {
    logger.info('--dry-run passed: fetching affected items');
    let result = await request(
      'GET',
      {
        lightning: options.lightning,
        token: options.token!,
        key: options.key,
        collectionName: options.collectionName,
      },
      logger
    );
    const keys = Object.keys(result);
    logger.info('Keys to be removed:');
    logger.print(keys);

    logger.always('Aborting request - keys have not been removed');
  } else {
    let result = await request(
      'DELETE',
      {
        lightning: options.lightning,
        token: options.token!,
        key: options.key,
        collectionName: options.collectionName,
        query: buildQuery(options),
      },
      logger
    );

    logger.success(`Removed ${result.deleted} items`);
  }
};

export default {
  get,
  set,
  remove,
};
