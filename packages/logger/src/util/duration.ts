// simple function for printing durations
// If this gets any more complex we should use a library

export default (timeInMs: number) => {
  if (timeInMs < 1000) {
    return `${timeInMs}ms`;
  }
  const seconds = timeInMs / 1000;
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = seconds / 60;
  return `${Math.floor(minutes)}m ${seconds % 60}s`;
};
