import { WebSocket } from 'ws';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import createLogger from '@openfn/logger';

import { Logger } from '../util/logger';
import { ApolloOptions } from './command';
import { getURL, outputFiles } from './util';

// TODO add a "dir" sub command which will load basic docs

const apolloHandler = async (options: ApolloOptions, logger: Logger) => {
  logger.always(`Calling Apollo service: ${options.service}`);
  // this doesn't have to do much
  // load the input json
  const json = await loadPayload(logger, options.payload);

  // work out the server url
  const url = getURL(options);
  logger.success(`Using apollo server at`, url);
  // call the server
  const result = await callApollo(url, options.service, json, logger);

  if (result) {
    await serializeOutput(options, result, logger);
  } else {
    logger.warn('No output returned from Apollo');
  }

  logger.success('Done!');
};

const write = async (
  basePath: string,
  filePath: string,
  content: string,
  logger: Logger
) => {
  const ext = path.extname(basePath);
  let dir;
  if (ext) {
    dir = path.dirname(path.resolve(basePath));
  } else {
    dir = basePath;
  }

  // Ensure the root dir exists
  await mkdir(dir, { recursive: true });

  // TODO if basepath is a file, and there's file path, create the filepath next to it
  const dest = path.resolve(basePath, filePath);
  // TODO if the content is JSON, should we pretty print it?
  await writeFile(dest, content);

  // TODO mabye here we just log the relative path from pwd, but we log to
  // debug or info the absolute path
  logger.success(`Wrote content to ${dest}`);
};

// appollo should write to stdout unless a path is provided
const serializeOutput = async (
  options: Pick<Opts, 'outputStdout' | 'outputPath'>,
  result: any,
  logger: Logger
) => {
  // print to disk
  if (options.outputPath) {
    if (result.files) {
      for (const p in result.files) {
        await write(options.outputPath, p, result.files[p], logger);
      }
    } else {
      await write(options.outputPath, '', result.files, logger);
    }
    return;
  }

  // print to stdout
  logger.success('Result:');
  if (result.files) {
    outputFiles(result.files, logger);
  } else {
    logger.always(JSON.stringify(result, undefined, 2));
  }
};

const callApollo = async (
  apolloBaseUrl: string,
  serviceName: string,
  payload: any,
  logger: Logger
) => {
  return new Promise((resolve, reject) => {
    const apolloLogger = createLogger('APO', { level: 'debug' });

    const url = `${apolloBaseUrl.replace(
      /^http/,
      'ws'
    )}/services/${serviceName}`;

    logger.always('Calling apollo: ', url);

    const socket = new WebSocket(url);

    socket.addEventListener('message', ({ data }) => {
      const evt = JSON.parse(data);
      if (evt.event === 'complete') {
        logger.debug('Apollo responded with: ', evt.data);
        resolve(evt.data);
      } else if (evt.event === 'log') {
        apolloLogger.info(evt.data);
      }
    });

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          event: 'start',
          data: payload,
        })
      );
    });
  });
};

const loadPayload = async (logger: Logger, path?: string): Promise<any> => {
  if (!path) {
    logger.warn('No JSON payload provided');
    logger.warn('Most apollo services require JSON to be uploaded');
    return {};
  }
  if (path.endsWith('.json')) {
    const str = await readFile(path, 'utf8');
    const json = JSON.parse(str);
    logger.debug('Loaded JSON payload');
    return json;
  }
  // TODO also load a js module (default export)
};

export default apolloHandler;
