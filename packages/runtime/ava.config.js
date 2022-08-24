module.exports = {
  extensions: {
    // Because of how we've handled vm as an external dependency in langauge-common,
    // we need to compile ts code to cjs
    ts: "commonjs"
  },

  nodeArguments: [
    "--experimental-vm-modules"
  ],

  "require": [
    "ts-node/register"
  ],


  files: [
    "test/**/*test.ts"
  ]
}