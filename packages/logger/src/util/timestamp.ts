// Take a snapshot of the time-on-load load at nanosecond precision
// We use this as a base to calculate timestamps later
const start = BigInt(Date.now()) * BigInt(1e6);

const startDiff = process.hrtime.bigint();

// The timestamp is: workout the time elapsed (in nanoseconds) and add that to the start date
export default () => start + (process.hrtime.bigint() - startDiff);

// Util to convert a bigint timestamp to a date
export const timestampToDate = (time: bigint) =>
  new Date(Number(time / BigInt(1e6)));
