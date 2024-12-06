import path from 'node:path';
import { request } from 'undici';
import type { Dispatcher } from 'undici';
import { Logger } from '../util';

// helper function to call out to the collections API

// export const request = async (state, client, path, options = {}) => {

type Options = {
  key: string;
  collectionName: string;
  token: string;
  lightning?: string;

  includeMeta?: boolean; // TODO ignored right now
  pageSize?: number;

  data?: any;
};

type Key = string;

// This is what uploaded and downloaded data looks like
// Uploads don't include count and meta, but they're harmless
// For now, meta is discarded
type ItemSet = {
  items: Record<Key, any>;
  count?: number;
  meta?: Record<
    Key,
    {
      updated: string;
      created: string;
    }
  >;
};

// TODO we should try to autoparse strings into json right?
// we can take a flag to not do that

// TODO how should we return data?
// As a key: value object?
// what about metadata?
// Let's add that as a second object
// so you get: { items, metadata }

// TODO how should we handle cursor?
// Lets a) support limit and b) fetch everything
export default async (
  method: 'GET' | 'POST',
  options: Options,
  logger: Logger
) => {
  // if (!state.configuration.collections_token) {
  //   throwError('INVALID_AUTH', {
  //     description: 'No access key provided for collection request',
  //     fix: 'Ensure the "collections_token" value is set on state.configuration',
  //     path,
  //   });
  // }

  const base =
    options.lightning || 'http://localhost:4000' || 'https://app.openfn.org';

  const url = path.join(base, '/collections', options.collectionName);

  logger.debug('Calling Collections server at ', url);

  const headers = {
    Authorization: `Bearer ${options.token}`,
  };

  const query: any = {
    key: options.key,
    limit: options.pageSize || 1000,
  };

  const args: Partial<Dispatcher.RequestOptions> = {
    headers,
    method,
    query,
  };

  if (options.data) {
    args.body = JSON.stringify(options.data);
    args.headers['content-type'] = 'application/json';
  }

  // hmm, this is the result for paging a get
  // not quite what we need
  let result: ItemSet = {
    count: 0, // Set the count here so that it comes up first when serialized
    items: {},
  };

  let cursor;
  do {
    if (cursor) {
      args.query.cursor = cursor;
    }

    const response = await request(url, args);
    if (response.statusCode >= 400) {
      // await handleError(response, path, state.configuration.collections_endpoint);
      logger.error('error!');
    }
    const responseData: any = await response.body.json();

    if (responseData.items) {
      // Handle a get response
      logger.debug(
        'Received',
        response.statusCode,
        `- ${responseData.items.length} values`
      );
      for (const item of responseData?.items) {
        try {
          result.items[item.key] = JSON.parse(item.value);
        } catch (e) {
          result.items[item.key] = item.value;
        }
      }
      cursor = responseData.cursor;
    } else {
      // handle a set response
      logger.debug(
        'Received',
        response.statusCode,
        `- ${JSON.stringify(responseData)}`
      );
      result = responseData;
    }
  } while (cursor);

  return result;
};
