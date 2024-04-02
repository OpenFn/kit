import fs from 'node:fs/promises';
import path from 'node:path'


export const getCachePath = async (plan, options, stepId) => {
  const { baseDir } = options;

  // TODO ensure that plan always has a name
  // ( I do think the CLI sets a default?)
  const { name } = plan.workflow;

  const basePath = `${baseDir}/.cli-cache/${name}`;
  await fs.mkdir(basePath, { recursive: true })
  if (stepId) {
    const step = plan.workflow.steps.find(({ id }) => id === stepId);
    return path.resolve(`${basePath}/${step.name.replace(/ /, '-')}.json`);
  }
  return path.resolve(basePath);

}

// TODO this needs to move out into a util or something
export const saveToCache = async (plan, stepId, output, options) => {
  if (options.cache) {
    const cachePath = await getCachePath(plan, options, stepId);
    // TODO use the CLI logger
    console.log(`Writing ${stepId} output to ${cachePath}`)
    await fs.writeFile(cachePath, JSON.stringify(output))
  }
}