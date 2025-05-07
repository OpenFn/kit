export default (config: { endpoint?: string; env?: string } = {}) => {
  const endpoint = config.endpoint || 'local';
  const name = config.env ?? 'main';

  let host;
  try {
    host = new URL(endpoint).hostname;
  } catch (e) {
    // if an invalid endpoint is passed, assume it's local
    // this may not be fair??
    host = endpoint;
  }
  return `${name}@${host}`;
};
