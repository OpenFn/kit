import process from 'node:process';
import { registerCompletionHandler } from 'ava';

// For ava 6.0+
// See https://github.com/avajs/ava/blob/main/docs/08-common-pitfalls.md#timeouts-because-a-file-failed-to-exit
// It might be better to do this on a per test basis
registerCompletionHandler(() => {
  process.exit();
});
