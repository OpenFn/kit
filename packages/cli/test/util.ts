/*
 * test utils
 */
import mock from 'mock-fs';
import path from 'node:path';

export const mockFs = (files: Record<string, string>) => {
  const pnpm = path.resolve('../../node_modules/.pnpm');
  mock({
    [pnpm]: mock.load(pnpm, {}),
    '/repo/': mock.load(path.resolve('test/__repo__/'), {}),
    ...files,
  });
};

export const resetMockFs = () => {
  mock.restore();
};
