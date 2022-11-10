import { defineConfig } from 'tsup';
import Koa from 'koa';
import serve from 'koa-static';
import copyStaticFiles from 'esbuild-copy-static-files';

let app;

const onSuccess = () => {
  if (!app) {
    app = new Koa();
    app.use(serve('./dist'))
    console.log('Server running at localhost:1234')
    console.log(process.env.BROWSER_REFRESH_URL)
    app.listen(1234)
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
  noExternal: ["@openfn"],
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