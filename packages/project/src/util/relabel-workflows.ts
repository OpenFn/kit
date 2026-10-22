import Project from '../Project';
import Workflow from '../Workflow';

/**
 * Returns a copy of the project with some workflows given new ids
 *
 * `ids` maps current workflow id -> new id. Other workflows are untouched.
 *
 * The copy is shallow: only the workflow list and the cli meta are new
 */
export default function relabelWorkflows(
  project: Project,
  ids: Record<string, string>
): Project {
  const workflows = project.workflows.map((wf) =>
    ids[wf.id] && ids[wf.id] !== wf.id
      ? new Workflow({ ...(wf.toJSON() as any), id: ids[wf.id] })
      : wf
  );
  return Object.assign(Object.create(Object.getPrototypeOf(project)), project, {
    workflows,
    cli: { ...project.cli },
  });
}
