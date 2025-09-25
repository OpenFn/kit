import type { ProjectsOptions } from './command';
import type { Logger } from '../util/logger';
import path from 'path';
import fs from 'fs';
import readHead from '../util/read-head';

const projectsHandler = async (options: ProjectsOptions, logger: Logger) => {
  const commandPath = options.projectPath ?? process.cwd();
  // look for .projects folder
  const projectsDir = path.join(commandPath, '.projects');
  if (!fs.existsSync(projectsDir) || !fs.statSync(projectsDir).isDirectory()) {
    logger.error('.projects folder not found');
    return;
  }
  const projects = fs
    .readdirSync(projectsDir)
    .filter((name) => ['.yaml', '.yml'].includes(path.extname(name)));
  // for each yml file here, cat the head and find the name
  const foundProjects: { id: string; name: string }[] = [];
  for (const p of projects) {
    // get id and name
    const content = await readHead(path.join(projectsDir, p));
    const id = getYamlItem(content, 'id');
    const name = getYamlItem(content, 'name');
    if (id && name) {
      foundProjects.push({ id, name });
    }
  }

  if(!foundProjects.length){
    logger.error('No openfn project available');
    return;
  }

  let active: string | undefined;
  const activeProjectYaml = path.join(commandPath, 'openfn.yaml');
  if (
    fs.existsSync(activeProjectYaml) &&
    fs.statSync(activeProjectYaml).isFile()
  ) {
    active = getYamlItem(await readHead(activeProjectYaml), 'name');
  }else{
    logger.warn('No active project found')
  }

  process.stdout.write(
    `Available openfn projects\n\n${foundProjects
      .map((p) => p.name + (p.name === active ? ' (active)' : ''))
      .join('\n')}\n\n`
  );
};

export default projectsHandler;

function getYamlItem(content: string, key: string) {
  const rE = new RegExp(`^${key}:.+`, 'gm');
  return content.match(rE)?.[0]?.split(':')?.[1].trim();
}
