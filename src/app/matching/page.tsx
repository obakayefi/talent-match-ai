import PageHeader from "@/app/_components/PageHeader";
import { getJobsForWorkspace } from "@/modules/jobs/service";
import MatchingLab from "./MatchingLab";

export const dynamic = "force-dynamic";

export default async function MatchingPage() {
  const jobs = await getJobsForWorkspace();
  return (
    <div className="page-stack">
      <PageHeader
        description="Retrieve candidates, assess each job requirement with traceable evidence, and rank suitability using deterministic signals. Eligibility and score remain separate."
        eyebrow="Workspace · Matching"
        title="Candidate matching"
      />
      <MatchingLab jobs={jobs.map(({ id, title }) => ({ id, title }))} />
    </div>
  );
}
