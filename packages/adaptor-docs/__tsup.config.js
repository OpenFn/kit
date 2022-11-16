import { defineConfig } from 'tsup';
import baseConfig from '../../tsup.config';
import postcss from 'esbuild-postcss'
import cssModulesPlugin from 'esbuild-css-modules-plugin';
import postCssPlugin from 'esbuild-style-plugin';
import  tailwind from 'tailwindcss';

// TODO I'm abandoning tsup for the moment because I can't get it to handle
// tailwind AND inject the css into the file
export default defineConfig({
  ...baseConfig,
  dts: false,
  platform: 'browser',
  target: 'esnext',
  bundle: true,
  entry: {
    index: 'src/index.tsx',
  },
  esbuildPlugins: [
    // This does nothing
    postCssPlugin({
      postcss: {
        // extract: false,
        plugins: [tailwind],
      },
    }),

    // This works but seems to run before tailwind, so the inserted css hasn't been processed
    // cssModulesPlugin({
    //   inject: true,
    //   // v2: true,
    //   filter: /.\.css$/i
    // })
  ],
  esbuildOptions(options, context) {
    options.logLevel = 'debug';
  },
});
