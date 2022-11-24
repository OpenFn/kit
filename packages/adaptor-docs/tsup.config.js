import { defineConfig } from 'tsup';
import baseConfig from '../../tsup.config';
import postCssPlugin from 'esbuild-style-plugin';
import tailwind from 'tailwindcss';

export default defineConfig({
  ...baseConfig,
  dts: true,
  platform: 'browser',
  target: 'esnext',
  bundle: true,
  entry: {
    index: 'src/index.tsx',
  },
  esbuildPlugins: [
    postCssPlugin({
      postcss: {
        plugins: [tailwind],
      },
    }),
  ],
  esbuildOptions(options, context) {
    options.logLevel = 'debug';
  },
});
