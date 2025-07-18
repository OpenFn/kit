import test from 'ava';
import { differenceInMinutes } from 'date-fns';
import path from 'node:path';

import run, { clean } from '../src/run';
import { extractLogs, getJSON } from '../src/util';

const state = '{ \\"configuration\\": { \\"url\\": \\"x\\" } }';
const modulePath = path.resolve('modules/test');

let lastCreated: Date;

// For local dev, ensure the repo is clear
test.before(async () => {
  process.env.OPENFN_REPO_DIR = '/tmp/openfn/integration-tests/cli';
  await clean();
});

// Sleep after tests because weird exceptions keep popping up
test.afterEach(async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
});

// Generate metadata
test.serial(
  `openfn metadata -S "${state}" -a test=${modulePath} --log-json --log info`,
  async (t) => {
    const { stdout } = await run(t.title);
    t.regex(stdout, /Generating metadata/);
    t.regex(stdout, /Metadata function found. Generating metadata/);
    t.notRegex(stdout, /Returning metadata from cache/);

    const logJson = extractLogs(stdout);
    const [outputPath] = logJson.at(-1).message;
    t.regex(outputPath, /(repo\/.cli-cache\/)*(\.json)/);

    const metadata = getJSON(outputPath);
    t.is(metadata.name, 'test');
    t.is(metadata.type, 'model');

    // Check the created timestamp
    // As this is added at the very end, the created timestamp should be
    // within seconds of the current date.
    // We'll use a minute to give us plenty of leeway
    t.assert(differenceInMinutes(new Date(metadata.created), new Date()) < 1);

    // This affects the next test
    lastCreated = metadata.created;
  }
);

// return metadata from cache
test.serial(
  `openfn metadata -S "${state}" --adaptor test=${modulePath} --log-json --log info`,
  async (t) => {
    const { stdout } = await run(t.title);
    t.regex(stdout, /Generating metadata/);
    t.notRegex(stdout, /Metadata function found. Generating metadata/);
    t.regex(stdout, /Returning metadata from cache/);

    const logJson = extractLogs(stdout);
    const [outputPath] = logJson.at(-1).message;

    const metadata = getJSON(outputPath);
    t.is(metadata.name, 'test');
    t.is(metadata.type, 'model');

    // timestamp should be the same as before
    t.is(metadata.created, lastCreated);
  }
);

// Force regeneration
test.serial(
  `openfn metadata -S "${state}" --a test=${modulePath} -f --log-json --log info`,
  async (t) => {
    const { stdout } = await run(t.title);

    t.regex(stdout, /Generating metadata/);
    t.regex(stdout, /Metadata function found. Generating metadata/);
    t.notRegex(stdout, /Returning metadata from cache/);

    const logJson = extractLogs(stdout);
    const [outputPath] = logJson.at(-1).message;
    const metadata = getJSON(outputPath);
    t.is(metadata.name, 'test');
    t.is(metadata.type, 'model');

    // timestamp should have changed
    t.not(metadata.created, lastCreated);
    t.assert(differenceInMinutes(new Date(metadata.created), new Date()) < 1);
  }
);

// Generate without an adaptor name
test.serial(
  `openfn metadata -f -S "${state}" -a ${modulePath} --log-json --log info`,
  async (t) => {
    const { stdout } = await run(t.title);

    t.regex(stdout, /Generating metadata/);
    t.regex(stdout, /Metadata function found. Generating metadata/);
    t.notRegex(stdout, /Returning metadata from cache/);

    const logJson = extractLogs(stdout);
    const [outputPath] = logJson.at(-1).message;
    t.regex(outputPath, /(repo\/.cli-cache\/)*(\.json)/);

    const metadata = getJSON(outputPath);
    t.is(metadata.name, 'test');
    t.is(metadata.type, 'model');

    t.assert(differenceInMinutes(new Date(metadata.created), new Date()) < 1);

    // This affects the next test
    lastCreated = metadata.created;
  }
);

test.serial('does not log credentials', async (t) => {
  const sensitiveValue = '8888888';
  const state = `{ \\"configuration\\": { \\"pin_number\\": \\"${sensitiveValue}\\" } }`;
  const command = `openfn metadata -f -S "${state}" -a ${modulePath} --log-json --log debug`;
  const { stdout } = await run(command);

  const logJson = extractLogs(stdout);
  // trim the command from the logs because it contains the sensitive value
  const logString = JSON.stringify(logJson);

  // Should log the state object at least once
  t.regex(logString, /(pin_number)/i);
  t.notRegex(logString, new RegExp(sensitiveValue), 'i');
});

// When installing an adaptor that doesn't support metadata, the adaptor should be removed
test.serial(
  `openfn metadata -S "${state}" -a openfn@3.0.0 --log-json --log info`,
  async (t) => {
    const { stdout } = await run(t.title);

    t.regex(stdout, /Generating metadata/);
    t.regex(stdout, /Installing packages.../);
    t.regex(stdout, /Installed @openfn\/language-openfn@/);
    t.regex(stdout, /Installation complete in \d+\.\d+s/);
    t.regex(stdout, /No metadata helper found/);
    t.regex(stdout, /Removing unsupported adaptor from disk/);
    t.regex(stdout, /Adaptor removed and marked as unsupported/);
    t.regex(stdout, /successfully removed @openfn\/language-openfn_/i);
  }
);

// Cached unsupported adaptors are not downloaded again
test.serial(
  `openfn metadata -S "${state}" -a openfn@3.0.0 --log info --log-json `,
  async (t) => {
    const { stdout } = await run(t.title);

    t.regex(stdout, /known to not support metadata \(cached\)/);
    t.regex(stdout, /No metadata helper found/);
    // Should NOT try to install or remove again
    t.notRegex(stdout, /Installing packages/);
    t.notRegex(stdout, /Removing unsupported adaptor from disk/);
    t.notRegex(stdout, /successfully removed @openfn\/language-openfn_/);
  }
);

// metadata should work with implicit @latest (note that it'll still autoinstall)
test.serial(
  `openfn metadata -S "${state}" -a openfn --log-json --log info`,
  async (t) => {
    const { stdout } = await run(t.title);
    t.log(stdout);

    t.regex(stdout, /Generating metadata/);
    t.regex(stdout, /Installing packages.../);
    t.regex(stdout, /Installed @openfn\/language-openfn@/);
    t.regex(stdout, /Installation complete in \d+\.\d+s/);
    t.regex(stdout, /No metadata helper found/);
    t.regex(stdout, /Removing unsupported adaptor from disk/);
    t.regex(stdout, /Adaptor removed and marked as unsupported/);
    t.regex(stdout, /successfully removed @openfn\/language-openfn_/i);
  }
);

// ignore cache with --keep-unsupported
test.serial(
  `openfn metadata -S "${state}" -a http@7.0.0 --keep-unsupported --log-json --log info`,
  async (t) => {
    const { stdout } = await run(t.title);
    t.regex(stdout, /Generating metadata/);
    t.regex(stdout, /Installing packages.../);
    t.regex(stdout, /Installed @openfn\/language-http@/);
    t.regex(stdout, /Installation complete in \d+\.\d+s/);
    t.regex(stdout, /No metadata helper found/);
    t.regex(
      stdout,
      /Keeping unsupported adaptor as requested by --keep-unsupported flag/
    );
    // Should NOT try to remove the package
    t.notRegex(stdout, /Removing unsupported adaptor from disk/);
  }
);

// This test validates that even with --keep-unsupported, the cache works
test.serial(
  `openfn metadata -fS "${state}" -a http@7.0.0 --keep-unsupported --log-json --log info`,
  async (t) => {
    const { stdout } = await run(t.title);

    t.regex(stdout, /known to not support metadata/);
    t.regex(stdout, /No metadata helper found/);
    // Should NOT try to install again
    t.notRegex(stdout, /Installing packages/);
  }
);
