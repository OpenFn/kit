import { build } from "esbuild";
import pkg from "./package.json" assert { type: "json" };

const options = {
  bundle: true,
  write: true,
  watch: false,
  format: "esm",
  target: ["node16"],
  outdir: "./dist",
  platform: "node",
  sourcemap: false,
};

build({
  ...options,
  external: Object.keys(pkg.dependencies),
  entryPoints: [
    'src/index.ts'
  ]
})