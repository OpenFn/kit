import { UUID } from '@openfn/lexicon';
import Project from '../Project';

type Alias = string;
type ID = string;

const matchProject = (name: Alias | ID | UUID, candidates: Project[]) => {
  const [searchTerm, domain] = `${name}`.split('@');

  // Collect all matching projects
  const matchingProjects: Record<string, Project> = {};
  let multipleIdMatches = false;

  for (const project of candidates) {
    // If domain is specified, check if the project's endpoint matches
    if (domain) {
      if (project.host !== domain) {
        // Domain doesn't match, skip this project
        continue;
      }
    }

    if (project.id === searchTerm) {
      if (matchingProjects[project.id]) {
        multipleIdMatches = true;
      }
      matchingProjects[project.id] = project;
      continue;
    }

    if (project.alias === searchTerm) {
      matchingProjects[project.id] = project;
      continue;
    }

    // Check if it matches the UUID (partial or full)
    if (project.uuid && new RegExp(searchTerm, 'i').test(project.uuid)) {
      matchingProjects[project.id] = project;
      continue;
    }
  }

  const matches = Object.values(matchingProjects);

  // Multiple matches - throw error
  if (multipleIdMatches || matches.length > 1) {
    throw new Error(
      `Multiple projects match "${name}": ${matches
        .map((p) => p.id)
        .join(', ')}`
    );
  }
  return matches.length ? matches[0] : null;
};

export default matchProject;
