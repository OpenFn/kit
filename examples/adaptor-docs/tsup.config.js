import { defineConfig } from 'tsup';
import Koa from 'koa';
import serve from 'koa-static';
import copyStaticFiles from 'esbuild-copy-static-files';
import refresh from 'browser-refresh-client';

let app;

// start/restart a new koa server on finish
// but this doesn't help us hot reload...
const onSuccess = () => {
  if (!app) {
    const app = new Koa();
    app.use(serve('./dist'))
    console.log('Server running at localhost:1234')
    app.listen(1234)
  } else {
    // trigger a refresh
    refresh.refreshPage()
  }
}

export default defineConfig({
  entry: {
    'app': 'src/index.tsx'
  },
  format: 'esm',
  target: 'es2020',
  clean: true,
  watch: true,
  esbuildPlugins: [copyStaticFiles({
    src: './static/',
    dest: './dist/'
  })],
  esbuildOptions: (opts) => {
    opts.inject = ['src/shims.js'];
    return opts;
  },
  onSuccess
})