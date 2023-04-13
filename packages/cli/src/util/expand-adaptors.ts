import { Opts } from '../options';

const expand = (name: any) => {
  if (typeof name === 'string') {
    const [left] = name.split('=');
    // don't expand adaptors which look like a path (or @openfn/language-)
    if (left.match('/') || left.endsWith('.js')) {
      return name;
    }
    return `@openfn/language-${name}`;
  }
  return name;
};

export default (opts: Partial<Pick<Opts, 'adaptors' | 'workflow'>>) => {
  const { adaptors, workflow } = opts;

  if (adaptors) {
    opts.adaptors = adaptors?.map(expand);
  }

  if (workflow) {
    Object.values(workflow.jobs).forEach((job) => {
      if (job.adaptor) {
        job.adaptor = expand(job.adaptor);
      }
    });
  }

  return opts;
};
