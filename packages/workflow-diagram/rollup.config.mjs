import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import dts from "rollup-plugin-dts";

import pkg from "./package.json" assert { type: "json" };

export default [
  {
    input: "src/index.tsx",
    output: [
      {
        file: pkg.exports["."].import.default,
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [postcss(), typescript({ tsconfig: "./tsconfig.json" })],
    external: ["react", "react-dom", /elkjs*/, /react-flow/, "classcat", "zustand"],
  },
  {
    input: pkg.exports["."].import.types,
    output: [{ file: pkg.exports["."].import.types, format: "esm" }],
    plugins: [dts()],
    external: [/\.css$/u],
  },
];
