import { listJobs } from "./repository";

/** Application service used by server-rendered workspace routes. */
export async function getJobsForWorkspace() {
  return listJobs();
}
