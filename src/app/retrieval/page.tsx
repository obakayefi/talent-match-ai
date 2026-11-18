import PageHeader from "@/app/_components/PageHeader";
import { getJobsForWorkspace } from "@/modules/jobs/service";
import RetrievalLab from "./RetrievalLab";

export const dynamic = "force-dynamic";

export default async function RetrievalPage() {
  const jobs = await getJobsForWorkspace();
  return (
    <div className="page-stack">
      <PageHeader
        description="Run lexical, semantic, or fused retrieval over the synthetic candidate profiles. Results are recorded with their strategy configuration."
        eyebrow="Intelligence · Retrieval"
        title="Retrieval lab"
      />
      <RetrievalLab jobs={jobs.map(({ id, title }) => ({ id, title }))} />
    </div>
  );
}
