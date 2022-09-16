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
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
    ],
    external: ["fs", "events", "stream", "path", "util", "constants", "assert"],
  },
  {
    input: pkg.exports["."].import.types,
    output: [{ file: pkg.exports["."].import.types, format: "esm" }],
    plugins: [dts()],
  },
];
