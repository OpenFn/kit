import describeProject from './describe-project';
import { describePackage, loadDTS } from './api';

export type {
  FunctionDescription,
  PackageDescription,
  ParameterDescription,
} from './api';

// legacy exports - this should all be superceded by the new API
export { Pack } from './pack';
export type { Project } from './typescript/project';
export * from './fs/package-fs';

export {
  // legacy, deprecated
  describeProject as describeDts,

  // new hotness
  describePackage,
  loadDTS,
};
