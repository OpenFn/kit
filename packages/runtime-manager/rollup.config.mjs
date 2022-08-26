import typescript from "@rollup/plugin-typescript";

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
    ],
  },
  {
    input: "src/worker.ts",
    output: [{
        file: "dist/worker.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
    ],
  },
  // TODO this is only needed by tests, not for the release package
  // Ought to find a better solution really
  {
    input: "src/mock-worker.ts",
    output: [{
        file: "dist/mock-worker.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
    ],
  }
];
