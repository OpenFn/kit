import { createMockLogger, JSONLog } from '@openfn/logger';
import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import printVersions from '../../src/util/print-versions';

const root = path.resolve('package.json');

test('print versions for node, cli, runtime and compiler', async (t) => {
  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger);

  const last = logger._parse(logger._last);
  t.is(last.level, 'always');
  const message = last.message as string;

  // very crude testing but it's ok to test the intent here
  t.regex(message, /Versions:/);
  t.regex(message, /cli/);
  t.regex(message, /runtime/);
  t.regex(message, /compiler/);
  t.notRegex(message, /adaptor/);
});

test('print versions for node, cli, runtime, compiler and adaptor', async (t) => {
  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger, { adaptors: ['http'] });

  const last = logger._parse(logger._last);
  const message = last.message as string;

  t.regex(message, /Versions:/);
  t.regex(message, /cli/);
  t.regex(message, /runtime/);
  t.regex(message, /compiler/);
  t.regex(message, /http .+ latest/);
});

test('print versions for node, cli, runtime, compiler and adaptor with version', async (t) => {
  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger, { adaptors: ['http@1234'] });

  const last = logger._parse(logger._last);
  const message = last.message as string;

  // very crude testing but it's ok to test the intent here
  t.regex(message, /Versions:/);
  t.regex(message, /cli/);
  t.regex(message, /runtime/);
  t.regex(message, /compiler/);
  t.regex(message, /http .+ 1234/);
});

test('print versions for node, cli, runtime, compiler and long-form adaptor', async (t) => {
  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger, { adaptors: ['@openfn/language-http'] });

  const last = logger._parse(logger._last);
  const message = last.message as string;

  t.regex(message, /@openfn\/language-http .+ latest/);
});

test('print versions for node, cli, runtime, compiler and long-form adaptor with version', async (t) => {
  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger, { adaptors: ['@openfn/language-http@1234'] });

  const last = logger._parse(logger._last);
  const message = last.message as string;

  t.regex(message, /@openfn\/language-http .+ 1234/);
});

test('print version of adaptor with path', async (t) => {
  mock({
    '/repo/http/package.json': '{ "version": "1.0.0" }',
    [root]: mock.load(root, {}),
  });

  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger, {
    adaptors: ['@openfn/language-http=/repo/http'],
  });

  const last = logger._parse(logger._last);
  const message = last.message as string;

  t.regex(message, /@openfn\/language-http(.+)1\.0\.0/);
});

test('print version of adaptor with path and @', async (t) => {
  mock({
    '/repo/node_modules/@openfn/http/package.json': '{ "version": "1.0.0" }',
    [root]: mock.load(root, {}),
  });

  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger, {
    adaptors: ['@openfn/language-http=/repo/node_modules/@openfn/http'],
  });

  const last = logger._parse(logger._last);
  const message = last.message as string;

  t.regex(message, /@openfn\/language-http(.+)1\.0\.0/);
});

test('json output', async (t) => {
  const logger = createMockLogger('', { level: 'info', json: true });
  await printVersions(logger, { adaptors: ['http'], logJson: true });

  const last = JSON.parse(logger._last) as JSONLog;
  t.is(last.level, 'always');

  const [{ versions }] = last.message;
  t.truthy(versions['node.js']);
  t.truthy(versions['cli']);
  t.truthy(versions['runtime']);
  t.truthy(versions['compiler']);
  t.truthy(versions['http']);
});
