import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

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
    external: [...Object.keys(pkg.dependencies), "node:vm"],
    plugins: [typescript({ tsconfig: "./tsconfig.json" })],
  },
  {
    input: pkg.exports["."].import.types,
    output: [{ file: pkg.exports["."].import.types, format: "esm" }],
    external: [...Object.keys(pkg.dependencies), "node:vm"],
    plugins: [dts()],
  },
];
