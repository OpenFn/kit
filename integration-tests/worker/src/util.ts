export const run = async (lightning, attempt) => {
  return new Promise<any>(async (done, reject) => {
    lightning.on('run:complete', (evt) => {
      if (attempt.id === evt.runId) {
        done(lightning.getResult(attempt.id));
      } else {
        // If we get here, something has gone very wrong
        reject('attempt not found');
      }
    });

    lightning.enqueueRun(attempt);
  });
};

export const humanMb = (sizeInBytes: number) =>
  Math.round(sizeInBytes / 1024 / 1024);
