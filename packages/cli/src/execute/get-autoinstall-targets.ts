import type { ExecuteOptions } from './command';

const getAutoinstallTargets = (
  options: Partial<
    Pick<ExecuteOptions, 'adaptors' | 'autoinstall' | 'workflow'>
  >
) => {
  if (options.adaptors) {
    return options.adaptors?.filter((a) => !/=/.test(a));
  }
  if (options.workflow) {
    const adaptors = {};
    Object.values(options.workflow.jobs).forEach((job) => {
      if (job.adaptor) {
        adaptors[job.adaptor] = true;
      }
    });
    return Object.keys(adaptors);
  }
  return [];
};

export default getAutoinstallTargets;
