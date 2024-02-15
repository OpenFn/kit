import * as jose from 'jose';
import crypto from 'node:crypto';

export const generateRunToken = async (
  runId: string,
  privateKey?: string
): Promise<string> => {
  if (privateKey) {
    try {
      const alg = 'RS256';

      const key = crypto.createPrivateKey(privateKey);

      const jwt = await new jose.SignJWT({ id: runId })
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setIssuer('Lightning')
        .setExpirationTime('2h')
        .sign(key);
      return jwt;
    } catch (e) {
      console.error('ERROR IN MOCK LIGHTNING SERVER');
      console.error('Failed to generate JWT token for run ', runId);
      console.error(e);
    }
  }

  return 'x.y.z';
};
