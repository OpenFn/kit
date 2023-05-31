export default (execute, logger) => (ctx) => {
  logger.info('POST TO WORKFLOW');
  try {
    const attempt = ctx.request.body;
    // TODO should this return the result... ?
    // No other way to get hold of it
    execute(attempt);
    ctx.status = 200;
  } catch (e: any) {
    logger.error('Error starting attempt');
  }
};
