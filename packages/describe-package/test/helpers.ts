import { readFile } from "node:fs/promises";
import { Project } from "../src/project";

export function getDtsFixture(adaptorName: string): Promise<string> {
  return readFile(`test/fixtures/${adaptorName}.d.ts`, "utf-8");
}

export async function setupProject(dtsName: string): Promise<Project> {
  const project = new Project();
  
  // Load the target dts file
  const dts = await getDtsFixture(dtsName);
  
  // Load that dts into an index.dts
  project.createFile(dts, "index.d.ts");

  // Return the project and the path to index.dts
  return project;
}