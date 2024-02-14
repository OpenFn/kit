import fss from 'fast-safe-stringify';
import * as jose from 'jose';

export const RUN_PREFIX = 'run:';

export const extractRunId = (topic: string) => topic.substr(RUN_PREFIX.length);

// This is copied out of ws-worker and untested here
export const stringify = (obj: any): string =>
  fss(obj, (_key: string, value: any) => {
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    return value;
  });

export const generateKeys = async () => {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  return {
    // @ts-ignore export function
    public: publicKey.export({ type: 'pkcs1', format: 'pem' }),
    // @ts-ignore export function
    private: privateKey.export({ type: 'pkcs1', format: 'pem' }),
  };
};

export const toBase64 = (key: string) => Buffer.from(key).toString('base64');

export const fromBase64 = (key: string) =>
  Buffer.from(key, 'base64').toString();
