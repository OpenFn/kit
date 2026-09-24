#!/usr/bin/env node
// For a package's first release only — trusted publishing (and trust.mjs)
// both require the package to already exist on npm, so this does a plain
// `pnpm publish`, tags it, and then hands it off to scripts/trust.mjs so
// every later release can go through the normal CI trusted-publish flow.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const { pkg, otp, build } = yargs(hideBin(process.argv))
  .command(
    '$0 <pkg> <otp>',
    "Publish a new package's first release, tag it, and configure trust for future releases."
  )
  .positional('pkg', {
    type: 'string',
    description: 'short package name, e.g. cli',
  })
  .positional('otp', {
    type: 'string',
    description: 'a one-time password from your authenticator',
  })
  .option('build', {
    type: 'boolean',
    default: true,
    description: 'build the package first (use --no-build to skip)',
  })
  .example('$0 cli 123456', 'publish @openfn/cli for the first time')
  .demandCommand(0, 0)
  .strict()
  .parse();

const pkgPath = path.resolve('packages', pkg, 'package.json');
if (!existsSync(pkgPath)) {
  console.error(`No package found at packages/${pkg}`);
  process.exit(1);
}

const {
  name,
  version,
  private: isPrivate,
} = JSON.parse(readFileSync(pkgPath, 'utf8'));

if (isPrivate) {
  console.error();
  console.error(`${name} is private and is never published to npm.`);
  console.error();
  process.exit(1);
}

// This script is only for a package's first release. Anything already on
// npm should go through the normal publish flow in CI instead.
const published = spawnSync('npm', ['view', name, 'version'], {
  stdio: 'ignore',
});
if (published.status === 0) {
  console.error();
  console.error(
    `${name} is already published — this script is only for a package's first release.`
  );
  console.error(
    `Later releases go through CI once it's trusted; see "pnpm trust ${pkg} <otp>".`
  );
  console.error();
  process.exit(1);
}

function run(command, args) {
  const display = args.map((arg) => (arg === otp ? '***' : arg));
  console.log(`\n$ ${command} ${display.join(' ')}\n`);
  const { status } = spawnSync(command, args, { stdio: 'inherit' });
  if (status !== 0) {
    console.error(`\n${command} ${args[0]} failed for ${name}`);
    process.exit(status ?? 1);
  }
}

console.log(`Publishing ${name}@${version} for the first time`);

if (build) {
  run('pnpm', ['--filter', `./packages/${pkg}`, 'build']);
} else {
  console.log('\nSkipping build (--no-build)');
}

run('pnpm', [
  '--filter',
  `./packages/${pkg}`,
  'publish',
  '--access',
  'public',
  '--otp',
  otp,
]);

run('pnpm', ['changeset', 'tag']);
run('git', ['push', '--tags']);

// By this point the package is live on npm and tagged — that can't be
// undone from here, and re-running this script won't work either (the
// "already published" guard above would just reject it). So if trust
// fails, say so loudly and give the one command that actually finishes it.
const trustResult = spawnSync('node', ['scripts/trust.mjs', pkg, otp], {
  stdio: 'inherit',
});
if (trustResult.status !== 0) {
  console.error();
  console.error('='.repeat(60));
  console.error(`${name}@${version} IS published and tagged.`);
  console.error(`Only trust setup failed — this did NOT get undone.`);
  console.error();
  console.error(`Finish it with a fresh OTP:`);
  console.error();
  console.error(`  pnpm trust ${pkg} <otp>`);
  console.error('='.repeat(60));
  console.error();
  process.exit(trustResult.status ?? 1);
}

console.log(`\nDone. ${name}@${version} is published and trusted.`);
