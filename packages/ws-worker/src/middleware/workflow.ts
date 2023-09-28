import crypto from 'node:crypto';

export default (execute: any, logger: any) => (ctx: any) => {
  try {
    const attempt = ctx.request.body;
    if (!attempt.id) {
      // This is really useful from a dev perspective
      // If an attempt doesn't have an id, autogenerate one
      logger.info('autogenerating id for incoming attempt');
      attempt.id = crypto.randomUUID();
    }
    // TODO should this return the result... ?
    // No other way to get hold of it
    logger.info('Execute attempt ', attempt.id);
    execute(attempt);
    ctx.status = 200;
  } catch (e: any) {
    logger.error('Error starting attempt');
    console.log(e);
  }
};
