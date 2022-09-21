import typescript from "@rollup/plugin-typescript";
import shebang from 'rollup-plugin-preserve-shebang';
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
      shebang()
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
