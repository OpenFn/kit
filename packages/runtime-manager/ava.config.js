export default {
  extensions: {
    ts: "module"
  },

  nodeArguments: [
    "--loader=ts-node/esm",
    "--experimental-specifier-resolution=node"
  ],

  files: [
    "test/**/*test.ts"
  ],
}