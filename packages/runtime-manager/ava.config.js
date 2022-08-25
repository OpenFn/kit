export default {
  extensions: {
    ts: "module"
  },

  nodeArguments: [
    "--loader=ts-node/esm",
    "--experimental-specifier-resolution=node",
    "--experimental-vm-modules"
  ],

  files: [
    "test/**/*test.ts"
  ],
}