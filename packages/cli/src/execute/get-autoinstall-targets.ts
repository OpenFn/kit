import type { ExecuteOptions } from './command';

const getAutoinstallTargets = (
  options: Partial<
    Pick<ExecuteOptions, 'adaptors' | 'autoinstall' | 'workflow'>
  >
) => {
  if (options.workflow) {
    const adaptors = {};
    Object.values(options.workflow.jobs).forEach((job) => {
      if (job.adaptor) {
        adaptors[job.adaptor] = true;
      }
    });
    return Object.keys(adaptors);
  }
  if (options.adaptors) {
    return options.adaptors?.filter((a) => !/=/.test(a));
  }
  return [];
};

export default getAutoinstallTargets;
