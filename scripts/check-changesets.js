/**
 * Exits with error if a package changed without a changeset
 *
 * Usage: node scripts/check-changesets.js [base-branch]   (default main)
 */

const { execFileSync } = require('node:child_process');
const {
  readFileSync,
  existsSync,
  unlinkSync,
  appendFileSync,
} = require('node:fs');
const path = require('node:path');

// Top-level dirs whose packages must carry a changeset when changed
// Add 'integration-tests' here to also gate the private test-harness packages
const SCOPE_DIRS = ['packages'];

const GH_LABEL = 'No changeset needed';

// Branch to compare against - the workflow passes the PR's target branch
const branch = (process.argv[2] || 'main').replace(/^origin\//, '');
const baseRef = `origin/${branch}`;

const git = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const tryGit = (args) => {
  try {
    return git(args);
  } catch {
    return null;
  }
};

// Where this branch diverged from the base (the merge-base), so we compare only
// what the PR changed, not what the base has since moved on to. A full checkout
// (fetch-depth: 0) already has the history; otherwise fetch the base to get it
let mergeBase = tryGit(['merge-base', baseRef, 'HEAD']);
if (!mergeBase) {
  tryGit([
    'fetch',
    '--no-tags',
    'origin',
    `${branch}:refs/remotes/origin/${branch}`,
  ]);
  mergeBase = tryGit(['merge-base', baseRef, 'HEAD']);
}
if (!mergeBase) {
  console.error(
    `Could not find where HEAD diverged from "${baseRef}" - use a full checkout (fetch-depth: 0)`
  );
  process.exit(2);
}

// Every file that differs from the merge-base: committed + staged + unstaged,
// plus anything untracked - matches what a PR contains and what you have locally
const diffed = git(['diff', '--name-only', mergeBase]).split('\n');
const untracked = git(['ls-files', '--others', '--exclude-standard']).split(
  '\n'
);

const scopePattern = new RegExp(`^(${SCOPE_DIRS.join('|')})/([^/]+)/`);
const changedDirs = new Set();
for (const file of diffed.concat(untracked)) {
  const match = file.match(scopePattern);
  if (match) {
    changedDirs.add(`${match[1]}/${match[2]}`);
  }
}

// Map each changed dir to its package name, skipping unpublishable packages
const changed = new Map();
for (const dir of changedDirs) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    continue; // no manifest (e.g. a removed package)
  }
  // Mirror changesets: a package with no version is never released
  if (pkg.name && pkg.version) {
    changed.set(pkg.name, dir);
  }
}

// Ask changesets which packages are marked for release (the "covered" set).
// Going through the CLI means we never parse the changeset file format ourselves
const covered = new Set();
const planFile = path.join(process.cwd(), '.changeset-status.json');
try {
  const stdout = execFileSync(
    'pnpm',
    ['exec', 'changeset', 'status', '--output', planFile],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  console.log('[changeset status] exit 0');
  console.log('[changeset status] stdout:\n', stdout);
} catch (e) {
  // status exits non-zero and writes nothing when packages changed but no
  // changesets exist yet - nothing is marked for release, covered stays empty
  console.log('[changeset status] exit', e.status);
  console.log('[changeset status] stdout:\n', e.stdout?.toString() ?? '');
  console.log('[changeset status] stderr:\n', e.stderr?.toString() ?? '');
}
if (existsSync(planFile)) {
  const plan = JSON.parse(readFileSync(planFile, 'utf8'));
  console.log({ plan });
  // changesets[] = packages a changeset explicitly names. Not releases[], which
  // also includes transitive dependency bumps we don't want to treat as covered
  for (const changeset of plan.changesets) {
    for (const release of changeset.releases) {
      covered.add(release.name);
    }
  }
  unlinkSync(planFile);
}

// Any changed package that no changeset accounts for
const missing = Array.from(changed.keys())
  .filter((name) => !covered.has(name))
  .sort();

if (missing.length === 0) {
  console.log('✔ Every changed package has a changeset');
  process.exit(0);
}

// Inline annotations on the PR checks tab
for (const name of missing) {
  console.log(`::error::Missing a changeset for ${name}`);
}

const lines = ['', 'These changed packages have no changeset:'];
for (const name of missing) {
  lines.push(`  - ${name}`);
}
console.error(lines.join('\n'));
console.error('\nAdd one and commit it:\n  pnpm changeset');
console.error(
  `\nIf this PR does not need a release, add the "${GH_LABEL}" label.\n`
);

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    '### ❌ Changeset check failed',
    '',
    'These changed packages have no changeset:',
  ];
  for (const name of missing) {
    summary.push(`- \`${name}\``);
  }
  summary.push(
    '',
    'Run `pnpm changeset` and commit the result, or add the',
    `**${GH_LABEL}** label if no release is needed.`
  );
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
}

process.exit(1);
