// Take a snapshot of the time now, when the module is loaded
const start = BigInt(Date.now()) * BigInt(1e3);

// The timestamp is the start time + bigint ns
export default () => start + process.hrtime.bigint() / BigInt(1e9);

// Util to convert a bigint timestamp to a date
export const timestampToDate = (time: bigint) =>
  new Date(Number(time / BigInt(1e3)));
