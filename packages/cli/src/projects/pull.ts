import { handler as fetch } from './fetch';
import { handler as checkout } from './checkout';

import type { Logger } from '../util/logger';
import type { Opts } from '../options';

export type PullOptions = Pick<
  Opts,
  | 'apiKey'
  | 'endpoint'
  | 'env'
  | 'force'
  | 'log'
  | 'logJson'
  | 'projectId'
  | 'workspace'
>;

export async function handler(options: PullOptions, logger: Logger) {
  const project = await fetch(options, logger);
  logger.success(`Downloaded latest project version`);

  await checkout(
    {
      ...options,
      projectId: project.id,
    },
    logger
  );
  logger.success(`Checked out project locally`);
}

export default handler;
