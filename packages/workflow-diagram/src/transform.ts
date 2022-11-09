import cronstrue from "cronstrue";
import { Trigger, Workflow, Job } from "./types";

export function generateDescription(trigger: Trigger): string | null {
  switch (trigger.type) {
    case "webhook":
      return `When data is received at ${trigger.url}`;
    case "cron":
      return cronstrue.toString(trigger.expression);
    default:
      return null;
  }
}

export function renameUntitledWorkflows(workflows: Workflow[]): Workflow[] {
  return workflows.map((workflow) => {
    const name = workflow.name ?? "Untitled";
    return { ...workflow, name } as Workflow;
  });
}
export function addDescription(jobs: Job[]): Job[] {
  return jobs.map((job) => {
    const { trigger } = job;
    const description = generateDescription(trigger);
    return { ...job, trigger: { ...trigger, description } as Trigger } as Job;
  });
}
