import { defineConfig } from 'tsup';
import Koa from 'koa';
import serve from 'koa-static';
import websockify from 'koa-websocket'

import copyStaticFiles from 'esbuild-copy-static-files';

let app;
let listeners = []

const onSuccess = () => {
  if (!app) {
    app = new websockify(new Koa());
    app.use(serve('./dist'))
    console.log('Server running at localhost:1234')
    app.listen(1234)
    
    app.ws.use((ctx) => {
      listeners.push(ctx)
    });
  } else {
    console.log('triggering refresh')
    while (listeners.length) {
      listeners.pop().websocket.send('refresh')
    }
  }
}

export default defineConfig({
  entry: {
    'app': 'src/index.tsx'
  },
  format: 'esm',
  platform: 'browser',
  clean: true,
  bundle: true,
  watch: ['.', '../../packages/adaptor-docs/dist'],
  noExternal: ["@openfn/adaptor-docs", "react"],
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