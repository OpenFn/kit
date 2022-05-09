import { build } from "esbuild";
import esbuildPluginPostcss from 'esbuild-postcss';

(async () => {
  await build({
    plugins: [esbuildPluginPostcss()],
    bundle: true,
    platform: "browser",
    // Defines env variables for bundled JavaScript; here `process.env.NODE_ENV`
    // is propagated with a fallback.
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
    },
    entryPoints: ["src/index.tsx"],
    external: ['react', 'react-dom'],
    incremental: false,
    // Removes whitespace, etc. depending on `NODE_ENV=...`.
    minify: process.env.NODE_ENV === "production",
    outfile: "dist/index.js",
    sourcemap: true,
  });
})();
