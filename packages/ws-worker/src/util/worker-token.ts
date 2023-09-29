import * as jose from 'jose';

const alg = 'HS256';

const generateWorkerToken = async (secret: string, workerId: string) => {
  if (!secret) {
    // TODO use proper logger
    // TODO is this even necessary?
    console.warn();
    console.warn('WARNING: Worker Secret not provided!');
    console.warn(
      'This worker will attempt to connect to Lightning with default secret'
    );
    console.warn();
  }

  const encodedSecret = new TextEncoder().encode(secret || '<secret>');

  const claims = {
    worker_id: workerId,
  };

  const jwt = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer('urn:example:issuer')
    .setAudience('urn:example:audience')
    .sign(encodedSecret);
  // .setExpirationTime('2h') // ??

  return jwt;
};

export default generateWorkerToken;
