import Project from '../Project';
import Workflow from '../Workflow';
import { generateHash } from './version';

export type ChangedWorkflows = {
  changed: Workflow[];
  // ids of workflows present in forked_from/history but no longer in the
  // project - ids only, since the removed workflow itself is gone from
  // `project`. The caller needs the *target's* copy to flag via remove().
  removed: string[];
};

/**
 * For a given Project, identify which workflows have changed
 * Uses forked_from as the base, or history if that's unavailable
 */
export default (project: Project): ChangedWorkflows => {
  const base: Record<string, string> =
    project.cli.forked_from ??
    project.workflows.reduce((obj: any, wf) => {
      if (wf.history.length) {
        obj[wf.id] = wf.history.at(-1);
      }
      return obj;
    }, {});

  const changed: Workflow[] = [];

  for (const wf of project.workflows) {
    if (wf.id in base) {
      const hash = generateHash(wf);
      if (hash !== base[wf.id]) {
        changed.push(wf);
      }
      delete base[wf.id];
    } else {
      // If a workflow doesn't appear in forked_from, we assume it's new
      // (and so changed!)
      changed.push(wf);
    }
  }

  // Anything in forked_from that hasn't been handled must have been removed
  const removed = Object.keys(base);

  return { changed, removed };
};
