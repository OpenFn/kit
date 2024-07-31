export default (payload: string, limit_mb?: number) => {
  // @ts-ignore
  if (!isNaN(limit_mb)) {
    const limit = limit_mb as number;
    const size_bytes = Buffer.byteLength(payload, 'utf8');
    const size_mb = size_bytes / 1024 / 1024;
    if (size_mb > limit) {
      const e = new Error();
      // @ts-ignore
      e.severity = 'kill';
      e.name = 'PAYLOAD_TOO_LARGE';
      e.message = `The payload exceeded the size limit of ${limit}mb`;
      throw e;
    }
  }
};
