import PageHeader from "@/app/_components/PageHeader";
import { getJobsForWorkspace } from "@/modules/jobs/service";
import { getEvaluationHistory } from "@/modules/evaluation/service";
import EvaluationLab from "./EvaluationLab";

export const dynamic = "force-dynamic";

export default async function EvaluationPage() {
  const [jobs, history] = await Promise.all([getJobsForWorkspace(), getEvaluationHistory()]);
  return (
    <div className="page-stack">
      <PageHeader
        description="Measure retrieval and deterministic ranking against the complete, manually authored candidate–job judgments."
        eyebrow="Intelligence · Evaluation"
        title="Evaluation lab"
      />
      <EvaluationLab
        jobs={jobs.map(({ id, title }) => ({ id, title }))}
        initialHistory={history}
        initialAssessmentDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
