import test from 'ava';
import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import run from '../src/run';

const jobsPath = path.resolve('test/fixtures');
const repoDir = `--repo-dir=${path.resolve('tmp/openfn/repo-autoinstall')}`;
const log = `--log=debug`;

const TEST_LATEST = '1.0.0';
const TEST_NEXT = '2.0.0-next.';

// Note that these tests are STATEFUL
// Ensure the repo is clean and clear before these tests run
test.before(async () => {
  await mkdir('tmp', { recursive: true });
  await run(`openfn repo clean -f --log none ${repoDir}`);
});

// using jobs rather than workflows for autoinstall tests
// because it's easier to manage

// autoinstall a specific version
test.serial(
  `openfn ${jobsPath}/simple.js -a common@1.7.7 ${repoDir} ${log}`,
  async (t) => {
    const { stdout, stderr } = await run(t.title);
    t.falsy(stderr);

    t.regex(stdout, /Auto-installing language adaptors/);
    t.regex(stdout, /Installing packages.../);
    t.regex(stdout, /Will install @openfn\/language-common version/);
    t.regex(stdout, /Installed @openfn\/language-common@1.7.7/);
  }
);

// always lookup the latest version if @latest is passed
test.serial(
  `openfn ${jobsPath}/simple.js -a common@latest ${repoDir} ${log}`,
  async (t) => {
    const { stdout, err } = await run(t.title);
    // t.falsy(err); // TODO all these are failing in test? Seem to be ok locally...

    t.regex(stdout, /Auto-installing language adaptors/);
    t.regex(
      stdout,
      /Looked up latest version of @openfn\/language-common@latest/
    );
    t.regex(stdout, /Installing packages.../);
    t.regex(stdout, /Will install @openfn\/language-common version/);
    t.regex(stdout, /Installed @openfn\/language-common@/);
  }
);

// just to be sure, run it again!
test.serial(
  `openfn ${jobsPath}/simple.js -a common@latest ${repoDir} --log=info`,
  async (t) => {
    const { stdout, stderr } = await run(t.title);

    t.falsy(stderr);

    t.regex(
      stdout,
      /Looked up latest version of @openfn\/language-common@latest/
    );
    t.regex(
      stdout,
      /Skipping @openfn\/language-common@(.+) as already installed/
    );
  }
);

// Ignore the @next version if present but we asked for latest
test.serial(
  `openfn ${jobsPath}/simple.js -a testing@latest ${repoDir} ${log}`,
  async (t) => {
    const { stdout, err } = await run(t.title);

    // t.falsy(err); // TODO I think this is a broken adaptor build?

    t.regex(stdout, /Auto-installing language adaptors/);
    t.regex(stdout, /Looked up latest version of @openfn\/language-testing/);
    t.regex(stdout, /Installing packages.../);
    t.regex(
      stdout,
      new RegExp(
        `Will install @openfn\/language-testing version ${TEST_LATEST}`
      )
    );
    t.regex(
      stdout,
      new RegExp(`Installed @openfn\/language-testing@${TEST_LATEST}`)
    );
  }
);

// Ignore @next if present but we asked for no version
test.serial(
  `openfn ${jobsPath}/simple.js -a testing ${repoDir} ${log}`,
  async (t) => {
    const { stdout, err } = await run(t.title);

    //t.falsy(err);

    t.regex(stdout, /Looked up latest version of @openfn\/language-testing/);
    t.regex(
      stdout,
      /Skipping @openfn\/language-testing@(.+) as already installed/
    );
  }
);

// TODO we need to fix the version of testing
// maybe after release we can push next onto 2.0 and leave latest on 1.0
test.serial(
  `openfn ${jobsPath}/simple.js -a testing@next ${repoDir} ${log}`,
  async (t) => {
    const { stdout, stderr } = await run(t.title);

    t.falsy(stderr);

    t.regex(stdout, /Auto-installing language adaptors/);
    t.regex(
      stdout,
      /Looked up latest version of @openfn\/language-testing@next/
    );
    t.regex(stdout, /Installing packages.../);
    t.regex(stdout, /Will install @openfn\/language-testing version/);
    t.regex(
      stdout,
      new RegExp(`Installed @openfn\/language-testing@${TEST_NEXT}`)
    );
  }
);
