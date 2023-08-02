// TODO update these
// test.serial('preserve repoDir', (t) => {
//   const initialOpts = {
//     repoDir: 'a/b/c',
//   } as Opts;

//   const opts = ensureOpts('a', initialOpts);

//   t.assert(opts.repoDir === 'a/b/c');
// });

// test.serial('use an env var for repoDir', (t) => {
//   process.env.OPENFN_REPO_DIR = 'JAM';

//   const initialOpts = {} as Opts;

//   const opts = ensureOpts('a', initialOpts);

//   t.truthy(opts.repoDir === 'JAM');
//   delete process.env.OPENFN_REPO_DIR;
// });

// test.serial('use prefer an explicit value for repoDirto an env var', (t) => {
//   process.env.OPENFN_REPO_DIR = 'JAM';

//   const initialOpts = {
//     repoDir: 'a/b/c',
//   } as Opts;

//   const opts = ensureOpts('a', initialOpts);

//   t.assert(opts.repoDir === 'a/b/c');
// });
// // TODO what if stdout and output path are set?
