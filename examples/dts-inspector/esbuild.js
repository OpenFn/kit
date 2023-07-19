import liveserver from 'live-server'; // dev server
import esbuild from 'esbuild';
import postcss from 'esbuild-postcss';

// TODO it's now possible to do serve through esbuild
liveserver.start({
  port: 8080, // Set the server port. Defaults to 8080.
  root: '.', // Set root directory that's being served. Defaults to cwd.
  open: false, // When false, it won't load your browser by default.
  wait: 500, // Waits for all changes, before reloading. Defaults to 0 sec.
  logLevel: 2, // 0 = errors only, 1 = some, 2 = lots
  ignore: 'node_modules/**/src',
});

const context = await esbuild.context({
  entryPoints: [
    'src/index.tsx',
    '@openfn/describe-package/worker',
    'src/from-unpkg.tsx',
  ],
  outdir: 'dist/',
  bundle: true,
  splitting: true,
  sourcemap: true,
  format: 'esm',
  target: ['es2020'],
  plugins: [postcss()],
});

await context.watch();
