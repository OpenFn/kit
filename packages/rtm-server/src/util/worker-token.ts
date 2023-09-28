import * as jose from 'jose';

const alg = 'HS256';

const generateWorkerToken = async (secret: string, workerId: string) => {
  const encodedSecret = new TextEncoder().encode(secret);

  const claims = {
    worker_id: workerId,
  };

  const jwt = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer('urn:example:issuer')
    .setAudience('urn:example:audience')
    // .setExpirationTime('2h')
    .sign(encodedSecret);

  return jwt;
};

export default generateWorkerToken;
