// Node 18 does not expose File as a global (it became global in Node 20)
// undici 7 (pulled in transitively via @openfn/lightning-mock) references
// globalThis.File at load time, so define it from node:buffer before any
// module graph is evaluated
if (typeof globalThis.File === 'undefined') {
  globalThis.File = require('node:buffer').File;
}
