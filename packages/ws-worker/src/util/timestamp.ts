import { TimeInMicroSeconds } from '@openfn/lexicon/lightning';

export const timeInMicroseconds = (time?: bigint) =>
  (time && (BigInt(time) / BigInt(1e3)).toString()) as TimeInMicroSeconds;
