import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import printVersions from '../../src/util/print-versions';

test('print versions for node, cli, runtime and compiler', async (t) => {
  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger);

  const last = logger._parse(logger._last);
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
  t.regex(message, /adaptor http .+ latest/);
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
  t.regex(message, /adaptor http .+ 1234/);
});

test('print versions for node, cli, runtime, compiler and long-form adaptor', async (t) => {
  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger, { adaptors: ['@openfn/language-http'] });

  const last = logger._parse(logger._last);
  const message = last.message as string;

  t.regex(message, /adaptor http .+ latest/);
});

test('print versions for node, cli, runtime, compiler and long-form adaptor with version', async (t) => {
  const logger = createMockLogger('', { level: 'info' });
  await printVersions(logger, { adaptors: ['@openfn/language-http@1234'] });

  const last = logger._parse(logger._last);
  const message = last.message as string;

  t.regex(message, /adaptor http .+ 1234/);
});
