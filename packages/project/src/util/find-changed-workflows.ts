import Project from '../Project';
import type Workflow from '../Workflow';
import { generateHash } from './version';

/**
 * For a given Project, identify which workflows have changed
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
      delete base[wf.id];
    } else {
      // If a workflow doens't appear in forked_from, we assume it's new
      // (and so changed!)
      changed.push(wf);
    }
  }

  // Anything in forked_from that hasn't been handled
  // must have been removed (and so changed!)
  for (const removedId in base) {
    changed.push({ id: removedId, $deleted: true } as unknown as Workflow);
  }

  return changed;
};
