import { writeFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, rmSync, fstat } from 'node:fs';
import path from 'node:path';

import { Opts } from '../options';
import type { Logger } from '../util/logger';

import { describePackage, PackageDescription } from '@openfn/describe-package';
import { getNameAndVersion } from '@openfn/runtime';

export type DocGenFn = (specifier: string) => Promise<PackageDescription>;

const RETRY_DURATION = 500;
const RETRY_COUNT = 20;

const TIMEOUT_MS = 1000 * 60;

const actualDocGen: DocGenFn = (specifier: string) =>
  describePackage(specifier, {});

// Ensure the path to a .json file exists
export const ensurePath = (filePath: string) =>
  mkdirSync(path.dirname(filePath), { recursive: true });

export const generatePlaceholder = (path: string) => {
  writeFileSync(path, `{ "loading": true, "timestamp": ${Date.now()}}`);
};

const finish = (logger: Logger, resultPath: string) => {
  logger.success('Done! Docs can be found at:\n');
  logger.print(`  ${path.resolve(resultPath)}`);
};

const generateDocs = async (
  specifier: string,
  path: string,
  docgen: DocGenFn,
  logger: Logger
) => {
  const result = await docgen(specifier);

  await writeFile(path, JSON.stringify(result, null, 2));
  finish(logger, path);
  return path;
};

const waitForDocs = async (
  docs: object,
  path: string,
  logger: Logger,
  retryDuration = RETRY_DURATION
): Promise<string> => {
  try {
    if (docs.hasOwnProperty('loading')) {
      // if this is a placeholder... set an interval and wait for JSON to be written
      // TODO should we watch with chokidar instead? The polling is actually kinda reassuring
      logger.info('Docs are being loaded by another process. Waiting.');
      return new Promise((resolve, reject) => {
        let count = 0;
        let i = setInterval(() => {
          logger.info('Waiting..');
          if (count > RETRY_COUNT) {
            clearInterval(i);
            reject(new Error('Timed out waiting for docs to load'));
          }
          const updated = JSON.parse(readFileSync(path, 'utf8'));
          if (!updated.hasOwnProperty('loading')) {
            logger.info('Docs found!');
            clearInterval(i);
            resolve(path);
          }
          count++;
        }, retryDuration);
      });
    } else {
      logger.info(`Docs already written to cache at ${path}`);
      finish(logger, path);
      return path;
      // If we get here the docs have been written, everything is fine
      // TODO should we sanity check the name and version? Would make sense
    }
  } catch (e) {
    // If something is wrong with the current JSON, abort for now
    // To be fair it may not matter as we'll write over it anyway
    // Maybe we should encourge a openfn docs purge <specifier> or something
    logger.error('Existing doc JSON corrupt. Aborting');
    throw e;
  }
};

// This function deliberately blocks woth synchronous I/O
// while it looks to see whether docs need generating
const docgenHandler = (
  options: Required<Pick<Opts, 'specifier' | 'repoDir'>>,
  logger: Logger,
  docgen: DocGenFn = actualDocGen,
  retryDuration = RETRY_DURATION
): Promise<string | void> => {
  const { specifier, repoDir } = options;

  const { version } = getNameAndVersion(specifier);
  if (!version) {
    logger.error('Error: No version number detected');
    logger.error('eg, @openfn/language-common@1.7.5');
    logger.error('Aborting');
    process.exit(9); // invalid argument
  }

  logger.success(`Generating docs for ${specifier}`); // TODO not success, but a default level info log.

  const path = `${repoDir}/docs/${specifier}.json`;
  ensurePath(path);

  const handleError = () => {
    // Remove the placeholder
    logger.info('Removing placeholder');
    rmSync(path);
  };

  try {
    const existing = readFileSync(path, 'utf8');
    const json = JSON.parse(existing);
    if (json && json.timeout && Date.now() - json.timeout >= TIMEOUT_MS) {
      // If the placeholder is more than TIMEOUT_MS old, remove it and try again
      logger.info(`Expired placeholder found. Removing.`);
      rmSync(path);
      throw new Error('TIMEOUT');
    }
    // Return or wait for the existing docs
    // If there's a timeout error, don't remove the placeholder
    return waitForDocs(json, path, logger, retryDuration);
  } catch (e) {
    // Generate docs from scratch
    if (e.message !== 'TIMEOUT') {
      logger.info(`Docs JSON not found at ${path}`);
    }
    logger.debug('Generating placeholder');
    generatePlaceholder(path);

    return generateDocs(specifier, path, docgen, logger).catch((e) => {
      logger.error('Error generating documentation');
      logger.error(e);
      handleError();
    });
  }
};

export default docgenHandler;
