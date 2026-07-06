/**
 * Exits with error if a package changed without a changeset
 *
 * Usage: node scripts/check-changesets.js [base-branch]   (default main)
 */

const { execFileSync } = require('node:child_process');
const { readFileSync, readdirSync, appendFileSync } = require('node:fs');
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

// Packages named across the frontmatter of every changeset file (the "covered"
// set) - read straight from disk so pending and uncommitted changesets count
const changesetDir = path.join(process.cwd(), '.changeset');
const covered = new Set();
for (const file of readdirSync(changesetDir)) {
  if (!file.endsWith('.md') || file.toLowerCase() === 'readme.md') {
    continue;
  }
  const contents = readFileSync(path.join(changesetDir, file), 'utf8');
  for (const name of changesetPackages(contents)) {
    covered.add(name);
  }
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

// Package names listed in a changeset's frontmatter block
function changesetPackages(contents) {
  const frontmatter = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    return [];
  }
  const names = [];
  for (const line of frontmatter[1].split('\n')) {
    // e.g.  '@openfn/cli': minor   or   "@openfn/cli": patch
    const entry = line.match(
      /^\s*['"]?(@?[\w./-]+)['"]?\s*:\s*(patch|minor|major)\s*$/
    );
    if (entry) {
      names.push(entry[1]);
    }
  }
  return names;
}
