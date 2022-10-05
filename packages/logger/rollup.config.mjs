import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json" assert { type: "json" };

export default [
  {
    input: ["src/index.ts"],
    output: [
      {
        file: pkg.exports["."].import.default,
        format: "esm",
        sourcemap: true,
      },
    ],
    external: [
      ...Object.keys(pkg.dependencies),
      /^node:/,
    ],
    plugins: [typescript({ tsconfig: "./tsconfig.json" })],
  },
];
