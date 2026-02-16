import Project from '../Project';
import { generateHash } from './version';

/**
 * For a give Project, identify which workflows have changed
 * Uses forked_from as the base, or history if that's unavailable
 */
export default (project: Project) => {
  const base: Record<string, string> =
    project.cli.forked_from ??
    project.workflows.reduce((obj: any, wf) => {
      if (wf.history.length) {
        obj[wf.id] = wf.history.at(-1);
      }
      return obj;
    }, {});

  const changed = [];

  for (const wf of project.workflows) {
    if (wf.id in base) {
      const hash = generateHash(wf);
      if (hash !== base[wf.id]) {
        changed.push(wf);
      }
    }
  }

  return changed;
};
