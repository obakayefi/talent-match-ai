import { listCandidates, listCandidatesWithDiagnostics } from "./repository";

/** Application service used by server-rendered workspace routes. */
export async function getCandidatesForWorkspace() {
  return listCandidates();
}

export async function getCandidateExplorerData() {
  return listCandidatesWithDiagnostics();
}
