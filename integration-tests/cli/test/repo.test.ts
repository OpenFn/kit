import test from 'ava';
import run from '../src/run';
import { extractLogs, assertLog } from '../src/util';

test.before(async () => {
  await run('openfn repo clean -f --log none');
});

// Not a very thorough test - BUT if clean breaks, many of these tests will also fail
test.serial('openfn repo clean -f', async (t) => {
  const { stdout } = await run(t.title);

  t.regex(stdout, /Repo cleaned/);
});

test.serial('openfn repo --log-json', async (t) => {
  const { stdout } = await run(t.title);

  const stdlogs = extractLogs(stdout);
  t.is(stdlogs.length, 2);
  t.regex(stdlogs[0].message[0], /Repo working directory/);
  t.regex(stdlogs[1].message[0], /Installed packages/);
});

test.serial('openfn repo list --log-json --log info', async (t) => {
  const { stdout } = await run(t.title);

  const stdlogs = extractLogs(stdout);
  t.is(stdlogs.length, 3);
  t.regex(stdlogs[0].message[0], /OPENFN_REPO_DIR is set to/);
  t.regex(stdlogs[1].message[0], /Repo working directory/);
  t.regex(stdlogs[2].message[0], /Installed packages/);
});

test.serial('openfn repo --help', async (t) => {
  const { stdout } = await run(t.title);

  t.regex(stdout, /Run commands on the module repo/);
  t.regex(stdout, /repo install \[packages...\]/);
  t.regex(stdout, /repo clean/);
  t.regex(stdout, /repo list/);
});

test.serial('openfn repo install -a common --log-json', async (t) => {
  const { stdout } = await run(t.title);

  const stdlogs = extractLogs(stdout);
  assertLog(t, stdlogs, /Installing packages/);
  assertLog(t, stdlogs, /Installed @openfn\/language-common@/);
  assertLog(t, stdlogs, /Installation complete in .*s/);
});

test.serial('openfn repo install is-array --log-json', async (t) => {
  const { stdout } = await run(t.title);

  const stdlogs = extractLogs(stdout);
  assertLog(t, stdlogs, /Installing packages/);
  assertLog(t, stdlogs, /Installed is-array@/);
  assertLog(t, stdlogs, /Installation complete in .*s/);
});

test.serial('openfn repo list --log-json', async (t) => {
  const { stdout } = await run(t.title);

  const stdlogs = extractLogs(stdout);
  t.regex(stdlogs[0].message[0], /Repo working directory/);
  t.regex(stdlogs[1].message[0], /Installed packages/);

  assertLog(t, stdlogs, /@openfn\/language-common/);
  assertLog(t, stdlogs, /is-array/);
});
