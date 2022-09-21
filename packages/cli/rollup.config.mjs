import typescript from "@rollup/plugin-typescript";
import shebang from "rollup-plugin-preserve-shebang";
import pkg from "./package.json" assert { type: "json" };

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: pkg.exports["."].import.default,
        format: "esm",
        sourcemap: true,
      },
    ],
    external: [
      ...Object.keys(pkg.dependencies),
      "node:path",
      "node:child_process",
      "yargs/helpers"
    ],
    plugins: [typescript({ tsconfig: "./tsconfig.json" }), shebang()],
  },
  {
    input: "src/process/child-process.ts",
    external: [
      ...Object.keys(pkg.dependencies),
      "node:fs/promises",
      "node:path",
      "node:child_process",
    ],
    output: [
      {
        file: "dist/process/child-process.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [typescript({ tsconfig: "./tsconfig.json" })],
  },
];
