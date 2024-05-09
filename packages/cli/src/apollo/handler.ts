import { WebSocket } from 'ws';
import { readFile } from 'node:fs/promises';
import createLogger from '@openfn/logger';
import { Logger } from '../util/logger';
import { ApolloOptions } from './command';
import { getURL } from './util';
import serializeOutput from '../execute/serialize-output';

// TODO add a "dir" sub command which will load basic docs

// export and test

const apolloHandler = async (options: ApolloOptions, logger: Logger) => {
  logger.always(`Calling Apollo service: ${options.service}`);
  // this doesn't have to do much
  // load the input json
  const json = await loadPayload(options.payload, logger);

  // work out the server url
  const url = getURL(options);
  logger.success(`Using apollo server at`, url);
  // call the server
  const result = await callApollo(url, options.service, json, logger);

  // write the result according to output rules
  await serializeOutput(options, result, logger);

  logger.success('Done!');
};

// const callApollo = async (
//   apolloBaseUrl: string,
//   serviceName: string,
//   payload: any,
//   logger: Logger
// ) => {
//   // TODO maybe use undici so I can mock it?
//   const url = `${apolloBaseUrl}/services/${serviceName}`;
//   logger.debug('Calling apollo: ', url);
//   const result = await fetch(url, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     // ts-ignore
//     body: JSON.stringify(payload),
//   });
//   logger.debug('Apollo responded with: ', result.status);

//   return result.json();

// };

// websocket implementation
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

    socket.addEventListener('message', ({ type, data }) => {
      const evt = JSON.parse(data);
      if (evt.event === 'complete') {
        logger.debug('Apollo responded with: ', evt.data);
        resolve(evt.data);
      } else if (evt.event === 'log') {
        apolloLogger.info(evt.data);
      }
    });

    socket.addEventListener('open', (event) => {
      socket.send(
        JSON.stringify({
          event: 'start',
          data: payload,
        })
      );
    });
  });
};

const loadPayload = async (path?: string, logger: Logger): Promise<any> => {
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
