export default {
  ...console,
  // Direct error and warn logs to stdout, so that they appear in sequence
  error: (...args: any[]) => console.log(...args),
  warn: (...args: any[]) => console.log(...args),
  success: (...args: any[]) => console.log(...args),
  always: (...args: any[]) => console.log(...args),
};
