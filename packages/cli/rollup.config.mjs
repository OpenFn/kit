import typescript from "@rollup/plugin-typescript";

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
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
    ],
  },
  {
    input: "src/process/child-process.ts",
    output: [
      {
        file: 'dist/process/child-process.js',
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
    ],
  },
];
