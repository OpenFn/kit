// Take a snapshot of the time-on-load load at nanosecond precision
// We use this as a base to calculate timestamps later
const start = BigInt(Date.now()) * BigInt(1e6);

// The timestamp is the start time + bigint time (in ns)
export default () => start + process.hrtime.bigint() / BigInt(1e6);

// Util to convert a bigint timestamp to a date
export const timestampToDate = (time: bigint) =>
  new Date(Number(time / BigInt(1e6)));
