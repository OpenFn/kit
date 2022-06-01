import { Job } from "../src/types";

export function OnFailJob(upstreamJob: Job, attrs: { name: string }): Job {
  return {
    id: attrs.name.toLowerCase().replace(/[?\W]+/g, "-"),
    adaptor: "@openfn/language-salesforce@2.8.1",
    trigger: { type: "on_job_failure", upstreamJob: upstreamJob.id },
    ...attrs,
  };
}

export function WebhookJob(attrs: { name: string, [key: string]: any }): Job {
  return {
    id: attrs.name.toLowerCase().replace(/[?\W]+/g, "-"),
    adaptor: "@openfn/language-salesforce@2.8.1",
    trigger: { type: "webhook" },
    ...attrs,
  };
}
