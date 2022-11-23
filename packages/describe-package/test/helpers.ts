import { readFile } from 'node:fs/promises';
import { Project } from '../src/typescript/project';

export function getDtsFixture(adaptorName: string): Promise<string> {
  return readFile(`test/fixtures/${adaptorName}.d.ts`, 'utf-8');
}

export async function setupProject(dtsName: string): Promise<Project> {
  const project = new Project();

  // Set up a mock language-common
  // This is sort of cheating but really helps me set up the pattern
  project.addTypeDefinition(
    '@openfn/language-common',
    // The comment is important because otherwise it'll be ignored
    `/** Common fn */
     export declare function fn(): void;`,
    'Adaptor.d.ts'
  );
  project.addTypeDefinition(
    '@openfn/language-common',
    `export * from './Adaptor`,
    'index.d.ts'
  );

  // Load the target dts file
  const dts = await getDtsFixture(dtsName);

  // Load that dts into an index.dts
  project.createFile(dts, 'index.d.ts');

  // Return the project and the path to index.dts
  return project;
}
