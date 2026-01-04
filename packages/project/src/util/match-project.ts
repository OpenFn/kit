import { UUID } from '@openfn/lexicon';
import Project from '../Project';

type Alias = string;
type ID = string;

export class MultipleMatchingProjectsError extends Error {}

const matchProject = (name: Alias | ID | UUID, candidates: Project[]) => {
  const [searchTerm, domain] = `${name}`.split('@');

  // Collect all matching projects
  const matchingProjects: Record<string, Project[]> = {};
  let multipleIdMatches = false;

  // Filter candidates by domain
  candidates = candidates.filter(
    (project) => !domain || project.host === domain
  );

  const re = new RegExp(searchTerm, 'i');
  for (const project of candidates) {
    if (
      project.id === searchTerm ||
      project.alias === searchTerm ||
      (project.uuid && re.test(project.uuid))
    ) {
      matchingProjects[project.id] ??= [];
      matchingProjects[project.id].push(project);
    }
  }

  const matches = Object.values(matchingProjects).flat();

  // Multiple matches - throw error
  if (multipleIdMatches || matches.length > 1) {
    throw new MultipleMatchingProjectsError(
      `Failed to resolve unique identifier for "${name}", clashes with: ${matches
        .map((p) => p.id)
        .join(', ')}`
    );
  }
  return matches.length ? matches[0] : null;
};

export default matchProject;
