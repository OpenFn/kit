import { Logger } from '../util';
import path from 'path';
import fs from 'fs';
import readHead from '../util/read-head';

interface FsProject {
  id: string;
  name: string;
  fileName: string;
  active?: boolean;
}

export default async function getFsProjects(
  projectsDir: string,
  logger: Logger
) {
  const projects = fs
    .readdirSync(projectsDir)
    .filter((name) => ['.yaml', '.yml'].includes(path.extname(name)));
  // for each yml file here, cat the head and find the name
  const foundProjects: FsProject[] = [];
  for (const p of projects) {
    // get id and name
    const content = await readHead(path.join(projectsDir, p));
    const id = getYamlItem(content, 'id');
    const name = getYamlItem(content, 'name');
    if (id && name) {
      foundProjects.push({ id, name, fileName: p });
    }
  }

  if (!foundProjects.length) return [];

  let active: string | undefined;
  const activeProjectYaml = path.join(path.dirname(projectsDir), 'openfn.yaml');
  if (
    fs.existsSync(activeProjectYaml) &&
    fs.statSync(activeProjectYaml).isFile()
  ) {
    active = getYamlItem(await readHead(activeProjectYaml), 'name');
  } else {
    logger.warn('No active project found');
  }

  return foundProjects.map((f) =>
    f.name === active ? { ...f, active: true } : f
  );
}

function getYamlItem(content: string, key: string) {
  const rE = new RegExp(`^${key}:.+`, 'gm');
  return content.match(rE)?.[0]?.split(':')?.[1].trim();
}
