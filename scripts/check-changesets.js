// Guard: fail if a package under packages/ changed without a changeset
//
// changed  = versionable packages with changes vs the base branch, counting
//            committed, staged, unstaged and untracked files - so it works the
//            same in CI (committed) and locally (working tree)
// covered  = packages named across the changeset files in .changeset/
// A package in `changed` but not in `covered` is an error
//
// Usage: node scripts/check-changesets.js [base-ref]   (default origin/main)

const { execFileSync } = require('node:child_process');
const { readFileSync, readdirSync, appendFileSync } = require('node:fs');
const path = require('node:path');

// Top-level dirs whose packages must carry a changeset when changed
// Add 'integration-tests' here to also gate the private test-harness packages
const SCOPE_DIRS = ['packages'];

const LABEL = 'No changeset needed';

const base = process.argv[2] || 'origin/main';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

// The commit where this branch diverged from the base branch
let mergeBase;
try {
  mergeBase = git(['merge-base', base, 'HEAD']);
} catch (err) {
  console.error(
    `Could not find a merge-base with "${base}" - is the base branch fetched?`
  );
  console.error(String(err.stderr || err.message || err));
  process.exit(2);
}

// Every file that differs from the base branch: committed + staged + unstaged,
// plus anything untracked - matches what a PR contains and what you have locally
const diffed = git(['diff', '--name-only', mergeBase]).split('\n');
const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n');

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
console.error(`\nIf this PR does not need a release, add the "${LABEL}" label.\n`);

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
    `**${LABEL}** label if no release is needed.`
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
