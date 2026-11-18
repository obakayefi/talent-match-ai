import PageHeader from "@/app/_components/PageHeader";
import { getCandidateExplorerData } from "@/modules/candidates/service";
import { logEvent } from "@/modules/observability/logger";
import type { Candidate } from "@/modules/candidates/schema";
import CandidateExplorer from "./CandidateExplorer";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  let candidates: Candidate[] = [];
  let invalidProfiles = 0;
  let unavailable = false;
  try {
    const result = await getCandidateExplorerData();
    candidates = result.candidates;
    invalidProfiles = result.rejectedCount;
  } catch (error) {
    unavailable = true;
    logEvent("error", "candidate.explorer.load_failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
  }
  return (
    <div className="page-stack">
      <PageHeader description="Inspect the synthetic candidate records, normalized profile data, and individual source responsibilities." eyebrow="Workspace · Candidate data" title="Candidate explorer" />
      <CandidateExplorer candidates={candidates} invalidProfiles={invalidProfiles} unavailable={unavailable} />
    </div>
  );
}
