import liveserver from 'live-server' // dev server
import esbuild from 'esbuild'
import postcss from 'esbuild-postcss'

// require('esbuild').buildSync({
//   entryPoints: ['src/index.jsx'],
//   bundle: true,
//   minify: false,
//   sourcemap: true,
//   target: ['es2020'],
//   outfile: 'dist/index.js',
// })

liveserver.start({
  port: 8080, // Set the server port. Defaults to 8080.
  root: '.', // Set root directory that's being served. Defaults to cwd.
  open: false, // When false, it won't load your browser by default.
  wait: 500, // Waits for all changes, before reloading. Defaults to 0 sec.
  logLevel: 2, // 0 = errors only, 1 = some, 2 = lots
  ignore: 'node_modules/**/src'
})

esbuild.build({
  entryPoints: ['src/index.jsx'],
  outfile: 'dist/index.js',
  bundle: true,
  sourcemap: true,
  plugins: [postcss()],
  watch: {
    onRebuild(error, result) {
      if (error) console.error('watch build failed:', error)
      else console.log('watch build succeeded:', result)
    },
  },
}).then(result => {
  console.log('watching...')
})
