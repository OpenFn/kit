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
});
