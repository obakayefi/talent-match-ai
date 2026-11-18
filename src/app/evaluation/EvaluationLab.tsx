"use client";

import { useMemo, useState } from "react";
import { DEFAULT_RANKING_WEIGHTS } from "@/modules/assessment/ranking";
import { compareEvaluationConfigurations, compareSeriesMetrics } from "@/modules/evaluation/comparison";
import { EvaluationHistorySchema, EvaluationRequestSchema, type EvaluationHistoryItem, type EvaluationJobResult, type EvaluationRun, type EvaluationSeries } from "@/modules/evaluation/schema";
import type { RetrievalStrategy } from "@/modules/retrieval/schema";
import styles from "./EvaluationLab.module.css";

type JobOption = { id: string; title: string };
type RankingWeights = typeof DEFAULT_RANKING_WEIGHTS;
const strategies: RetrievalStrategy[] = ["lexical", "semantic", "hybrid"];
const strategyLabels: Record<RetrievalStrategy, string> = { lexical: "Lexical retrieval", semantic: "Semantic retrieval", hybrid: "Hybrid · RRF" };
const weightLabels: Record<keyof RankingWeights, string> = {
  technicalSkills: "Technical skills",
  responsibilityAlignment: "Responsibility alignment",
  relevantExperience: "Relevant experience",
  domainRelevance: "Domain relevance",
  workPreference: "Work preference",
};

export default function EvaluationLab({
  jobs,
  initialHistory,
  initialAssessmentDate,
}: {
  jobs: JobOption[];
  initialHistory: EvaluationHistoryItem[];
  initialAssessmentDate: string;
}) {
  const [jobId, setJobId] = useState("all");
  const [selectedStrategies, setSelectedStrategies] = useState<RetrievalStrategy[]>(["lexical"]);
  const [kText, setKText] = useState("5, 10, 20");
  const [threshold, setThreshold] = useState(2);
  const [assessmentDate, setAssessmentDate] = useState(initialAssessmentDate);
  const [includeRanking, setIncludeRanking] = useState(true);
  const [includeCustomWeights, setIncludeCustomWeights] = useState(false);
  const [customWeights, setCustomWeights] = useState<RankingWeights>({ ...DEFAULT_RANKING_WEIGHTS });
  const [history, setHistory] = useState<EvaluationHistoryItem[]>(initialHistory);
  const [compareRunId, setCompareRunId] = useState(initialHistory[0]?.runId ?? "");
  const [currentRun, setCurrentRun] = useState<EvaluationRun>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const comparisonRun = history.find((run) => run.runId === compareRunId && run.runId !== currentRun?.runId);
  const comparison = useMemo(() => currentRun && comparisonRun ? compareEvaluationConfigurations(comparisonRun.configuration, currentRun.configuration) : undefined, [comparisonRun, currentRun]);

  function toggleStrategy(strategy: RetrievalStrategy) {
    setSelectedStrategies((previous) => previous.includes(strategy)
      ? previous.filter((value) => value !== strategy)
      : [...strategies.filter((value) => previous.includes(value) || value === strategy)]);
  }

  async function runEvaluation() {
    setError(undefined);
    setCurrentRun(undefined);
    const kValues = kText.split(",").map((value) => Number(value.trim()));
    const rankingConfigurations = includeRanking
      ? [
          { name: "Default weights", weights: DEFAULT_RANKING_WEIGHTS },
          ...(includeCustomWeights ? [{ name: "Custom weights", weights: customWeights }] : []),
        ]
      : [];
    const parsedRequest = EvaluationRequestSchema.safeParse({
      ...(jobId === "all" ? {} : { jobIds: [jobId] }),
      strategies: selectedStrategies,
      kValues,
      relevanceThreshold: threshold,
      assessmentDate,
      rankingConfigurations,
    });
    if (!parsedRequest.success) {
      setError(parsedRequest.error.issues.map(({ message }) => message).join(" "));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json() as EvaluationRun | { error?: { message?: string } };
      if (!response.ok) throw new Error("error" in payload ? payload.error?.message ?? "Evaluation failed." : "Evaluation failed.");
      const result = payload as EvaluationRun;
      setCurrentRun(result);
      const historyResponse = await fetch("/api/evaluation", { cache: "no-store" });
      if (historyResponse.ok) {
        const historyPayload = await historyResponse.json() as { runs: EvaluationHistoryItem[] };
        const parsedHistory = EvaluationHistorySchema.parse(historyPayload.runs);
        setHistory(parsedHistory);
        setCompareRunId((previous) => previous === result.runId ? parsedHistory.find(({ runId }) => runId !== result.runId)?.runId ?? "" : previous);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.lab}>
      <section className={`panel ${styles.controls}`} aria-label="Evaluation configuration">
        <div className={styles.controlGrid}>
          <label className={styles.control}>
            <span>Job scope</span>
            <select disabled={loading} value={jobId} onChange={(event) => setJobId(event.target.value)}>
              <option value="all">All jobs ({jobs.length})</option>
              {jobs.map((job) => <option value={job.id} key={job.id}>{job.title}</option>)}
            </select>
          </label>
          <label className={styles.control}>
            <span>K values (comma-separated)</span>
            <input disabled={loading} value={kText} onChange={(event) => setKText(event.target.value)} placeholder="5, 10, 20" />
          </label>
          <label className={styles.control}>
            <span>Binary relevant threshold</span>
            <select disabled={loading} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))}>
              <option value={1}>1 · weak or better</option>
              <option value={2}>2 · relevant or strong</option>
              <option value={3}>3 · strong only</option>
            </select>
          </label>
          <label className={styles.control}>
            <span>Assessment date</span>
            <input disabled={loading} type="date" value={assessmentDate} onChange={(event) => setAssessmentDate(event.target.value)} />
          </label>
        </div>

        <fieldset className={styles.strategyFieldset}>
          <legend>Retrieval strategies</legend>
          <div className={styles.checkRow}>
            {strategies.map((strategy) => <label className={styles.check} key={strategy}>
              <input disabled={loading} type="checkbox" checked={selectedStrategies.includes(strategy)} onChange={() => toggleStrategy(strategy)} />
              <span>{strategyLabels[strategy]}</span>
            </label>)}
          </div>
        </fieldset>

        <div className={styles.rankingOptions}>
          <label className={styles.check}>
            <input disabled={loading} type="checkbox" checked={includeRanking} onChange={(event) => setIncludeRanking(event.target.checked)} />
            <span>Evaluate final deterministic ranking</span>
          </label>
          {includeRanking && <label className={styles.check}>
            <input disabled={loading} type="checkbox" checked={includeCustomWeights} onChange={(event) => setIncludeCustomWeights(event.target.checked)} />
            <span>Compare custom signal weights with the default 30 / 30 / 20 / 10 / 10</span>
          </label>}
        </div>

        {includeRanking && includeCustomWeights && <div className={styles.weights}>
          {(Object.keys(weightLabels) as (keyof RankingWeights)[]).map((key) => <label className={styles.weightInput} key={key}>
            <span>{weightLabels[key]}</span>
            <input disabled={loading} type="number" min={0} max={100} step={1} value={customWeights[key]} onChange={(event) => setCustomWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} />
            <b>%</b>
          </label>)}
          <p>Custom values are normalized to 100% before ranking. At least one weight must be positive.</p>
        </div>}

        <div className={styles.actions}>
          <p>Uses the full judgment set for recall and graded labels for NDCG. Missing result slots count as non-relevant for Precision@K.</p>
          <button className="button-primary" type="button" disabled={loading || selectedStrategies.length === 0} onClick={runEvaluation}>
            {loading ? "Evaluating…" : "Run evaluation"}
          </button>
        </div>
      </section>

      {error && <div className={styles.error} role="alert"><strong>Evaluation could not complete.</strong><span>{error}</span></div>}
      {loading && <p className={styles.progress} role="status">Running selected retrieval strategies and ranking configurations against the complete judgment set. Semantic runs require the configured Ollama model.</p>}
      {currentRun && <EvaluationResults run={currentRun} />}

      <section className={styles.historySection}>
        <header className={styles.sectionHeader}><div><span>EXPERIMENT LOG</span><h2>Evaluation history</h2></div><small>Saved runs are immutable and include their configuration and candidate results.</small></header>
        {history.length === 0
          ? <div className={`panel ${styles.empty}`}><h3>No evaluation runs yet</h3><p>Run an evaluation to save real metrics and inspect historical experiments.</p></div>
          : <div className={styles.historyGrid}>
              <div className={styles.historyList}>
                {history.map((run) => <button className={`${styles.historyItem}${compareRunId === run.runId ? ` ${styles.historySelected}` : ""}`} key={run.runId} type="button" onClick={() => setCompareRunId(run.runId)}>
                  <span>{formatRunDate(run.createdAt)}</span>
                  <strong>{run.configuration.jobTitles.length === jobs.length ? "All jobs" : run.configuration.jobTitles.join(", ")}</strong>
                  <small>{run.configuration.strategies.join(" · ")} · threshold ≥ {run.configuration.relevanceThreshold} · {run.durationMs} ms</small>
                  <code>{run.runId}</code>
                </button>)}
              </div>
              <div className={styles.historyCompare}>
                {currentRun && comparisonRun ? <>
                  <h3>Compare current run with selected history</h3>
                  {comparison?.compatibleScope
                    ? <p className={styles.compatible}>Same jobs, K values, relevance threshold, and assessment date. {comparison.experimentDifferences.length ? `Experiment variables changed: ${comparison.experimentDifferences.join(", ")}.` : "The core evaluation scope matches."}</p>
                    : <p className={styles.incompatible}>Evaluation scope differs: {comparison?.scopeDifferences.join(", ")}. Metric changes are shown for inspection and are not a controlled comparison.</p>}
                  <HistoryMetricComparison current={currentRun} previous={comparisonRun} />
                </> : <div className={styles.emptyCompare}><h3>Choose a saved run to compare</h3><p>Run a new experiment, then select a prior run from this history list.</p></div>}
              </div>
            </div>}
      </section>
    </div>
  );
}

function EvaluationResults({ run }: { run: EvaluationRun }) {
  const rankingDistribution = run.series.filter(({ kind }) => kind === "ranking");
  return (
    <section className={styles.resultsSection} aria-live="polite">
      <header className={styles.resultsHeader}>
        <div><span>MEASURED RUN</span><h2>Evaluation results</h2><small>{run.configuration.jobTitles.join(" · ")}</small></div>
        <div className={styles.runFacts}><span>{run.configuration.strategies.join(" · ")}</span><span>K {run.configuration.kValues.join(", ")}</span><span>Threshold ≥ {run.configuration.relevanceThreshold}</span><span>{run.durationMs} ms total</span></div>
      </header>
      <div className={styles.statGrid}>
        <MetricStat label="Candidates in corpus" value={run.candidateCount} />
        <MetricStat label="Judgments used" value={run.groundTruthJudgmentCount} />
        <MetricStat label="Relevant labels at threshold" value={run.groundTruthRelevantCount} />
        <MetricStat label="Run ID" value={run.runId.slice(-10)} />
      </div>
      <p className={styles.methodNote}>Aggregate values are macro averages across completed jobs. MRR averages per-job reciprocal rank, with zero for jobs where no relevant result was found. Relevance labels are not eligibility labels.</p>

      <div className={styles.tableWrap}>
        <table className={styles.metricsTable}>
          <thead><tr><th>Evaluation series</th>{run.configuration.kValues.map((k) => <th key={`p${k}`}>P@{k}</th>)}{run.configuration.kValues.map((k) => <th key={`r${k}`}>R@{k}</th>)}{run.configuration.kValues.map((k) => <th key={`n${k}`}>NDCG@{k}</th>)}<th>MRR</th><th>Mean duration</th></tr></thead>
          <tbody>{run.series.map((series) => <AggregateRow key={series.key} series={series} kValues={run.configuration.kValues} />)}</tbody>
        </table>
      </div>
      {rankingDistribution.length > 0 && <EligibilitySummary series={rankingDistribution} />}
      <OverlapTable run={run} />
      <div className={styles.seriesGrid}>
        {run.series.map((series) => <SeriesBreakdown key={series.key} series={series} />)}
      </div>
      <details className={styles.configurationDetails}><summary>Inspect saved configuration</summary><pre>{JSON.stringify(run.configuration, null, 2)}</pre></details>
    </section>
  );
}

function MetricStat({ label, value }: { label: string; value: string | number }) {
  return <div className={styles.stat}><span>{label}</span><strong>{value}</strong></div>;
}

function percent(value: number | undefined) {
  return value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
}

function AggregateRow({ series, kValues }: { series: EvaluationSeries; kValues: number[] }) {
  const atK = new Map(series.aggregate.metricsAtK.map((metric) => [metric.k, metric]));
  return <tr>
    <th scope="row"><span className={styles.seriesKind}>{series.kind}</span>{series.kind === "ranking" ? `${strategyLabels[series.strategy]} · ${series.rankingConfiguration?.name}` : strategyLabels[series.strategy]}<small>{series.aggregate.jobsEvaluated}/{series.jobResults.length} jobs · {series.status}</small></th>
    {kValues.map((k) => <td key={`p${k}`}>{percent(atK.get(k)?.precisionAtK)}</td>)}
    {kValues.map((k) => <td key={`r${k}`}>{percent(atK.get(k)?.recallAtK)}</td>)}
    {kValues.map((k) => <td key={`n${k}`}>{percent(atK.get(k)?.ndcgAtK)}</td>)}
    <td>{series.aggregate.jobsEvaluated ? series.aggregate.meanReciprocalRank.toFixed(3) : "—"}</td>
    <td>{series.aggregate.jobsEvaluated ? `${series.aggregate.meanDurationMs.toFixed(1)} ms` : "—"}</td>
  </tr>;
}

function EligibilitySummary({ series }: { series: EvaluationSeries[] }) {
  return <section className={styles.eligibilityDistribution}>
    <span>ELIGIBILITY DISTRIBUTION · SEPARATE FROM RELEVANCE METRICS · RETRIEVED CANDIDATES ONLY</span>
    {series.map((item) => {
      const total = item.jobResults.reduce((count, result) => ({
        eligible: count.eligible + (result.eligibilityDistribution?.eligible ?? 0),
        needsReview: count.needsReview + (result.eligibilityDistribution?.needsReview ?? 0),
        notEligible: count.notEligible + (result.eligibilityDistribution?.notEligible ?? 0),
      }), { eligible: 0, needsReview: 0, notEligible: 0 });
      return <div className={styles.eligibilityRow} key={item.key}>
        <strong>{strategyLabels[item.strategy]} · {item.rankingConfiguration?.name}</strong>
        <b>Eligible {total.eligible}</b><b>Needs review {total.needsReview}</b><b>Not eligible {total.notEligible}</b>
      </div>;
    })}
  </section>;
}

function OverlapTable({ run }: { run: EvaluationRun }) {
  if (run.overlaps.length === 0) return null;
  return <details className={styles.overlapDetails}>
    <summary>Result-set Jaccard overlap across selected K values ({run.overlaps.length} comparisons)</summary>
    <div className={styles.tableWrap}><table className={styles.smallTable}><thead><tr><th>Job</th><th>Series A</th><th>Series B</th><th>Shared / union</th><th>Jaccard</th></tr></thead><tbody>
      {run.overlaps.map((overlap) => <tr key={`${overlap.jobId}/${overlap.seriesA}/${overlap.seriesB}`}><td>{run.configuration.jobTitles[run.configuration.jobIds.indexOf(overlap.jobId)]}</td><td>{overlap.seriesA}</td><td>{overlap.seriesB}</td><td>{overlap.intersection} / {overlap.union}</td><td>{percent(overlap.jaccard)}</td></tr>)}
    </tbody></table></div>
  </details>;
}

function SeriesBreakdown({ series }: { series: EvaluationSeries }) {
  return <section className={`panel ${styles.seriesCard}`}>
    <header><div><span className={styles.seriesKind}>{series.kind}</span><h3>{series.kind === "ranking" ? series.rankingConfiguration?.name : strategyLabels[series.strategy]}</h3><small>{strategyLabels[series.strategy]} · {series.status}</small></div><b>{series.aggregate.jobsEvaluated}/{series.jobResults.length} jobs</b></header>
    {series.jobResults.map((job) => <details className={styles.jobDetails} key={job.jobId}>
      <summary><span>{job.jobTitle}</span><small>{job.status === "complete" ? `${job.resultCount} results · MRR ${job.reciprocalRank.toFixed(3)} · ${series.kind === "retrieval" ? "retrieval" : "ranking"} ${job.durationMs ?? 0} ms` : job.error}</small></summary>
      {job.status === "complete" ? <>
        {job.model && <p className={styles.groundTruthCount}>Embedding provider: {job.provider ?? "unknown"} · {job.model}{job.modelVersion ? ` · model digest ${job.modelVersion}` : ""}{job.retrievalDurationMs !== undefined ? ` · retrieval ${job.retrievalDurationMs} ms` : ""}</p>}
        <div className={styles.jobMetricRow}>{job.metricsAtK.map((metric) => <span key={metric.k}>K={metric.k}: P {percent(metric.precisionAtK)} · R {percent(metric.recallAtK)} · NDCG {percent(metric.ndcgAtK)}</span>)}</div>
        <p className={styles.groundTruthCount}>{job.groundTruthJudgmentCount} manual labels; {job.groundTruthRelevantCount} meet threshold{job.noRelevantCandidates ? " · no relevant candidates for this job" : ""}.</p>
        {job.eligibilityDistribution && <p className={styles.groundTruthCount}>Eligibility distribution: {job.eligibilityDistribution.eligible} eligible · {job.eligibilityDistribution.needsReview} review · {job.eligibilityDistribution.notEligible} not eligible.</p>}
        {job.results.length > 0 && <div className={styles.tableWrap}><table className={styles.smallTable}><thead><tr><th>Rank</th><th>Candidate</th><th>{series.kind === "ranking" ? "Suitability" : "Strategy score"}</th><th>Relevance</th><th>Eligibility</th><th>Evidence / judgment rationale</th></tr></thead><tbody>
          {job.results.map((result) => <tr key={result.candidateId}><td>#{result.rank}</td><td>{result.candidateName}<small>{result.candidateId}</small></td><td>{result.score?.toFixed(series.kind === "ranking" ? 2 : 5) ?? "—"}</td><td><strong>{result.relevance}/3</strong></td><td>{result.eligibility ?? "—"}</td><td><span>{result.rationale}</span><small>{result.evidenceReferences.join(" · ") || "No evidence reference returned by this strategy."}</small></td></tr>)}
        </tbody></table></div>}
        {job.failureAnalysis.map((analysis) => <div className={styles.failureBlock} key={analysis.k}>
          <h4>Failure analysis at K={analysis.k}</h4>
          <p><b>Relevant missed:</b> {formatFailureList(analysis.missingRelevant)}</p>
          <p><b>Irrelevant returned:</b> {formatFailureList(analysis.irrelevantReturned)}</p>
          <p><b>Strong relevance ranked below K:</b> {formatFailureList(analysis.stronglyRelevantBelowK)}</p>
        </div>)}
      </> : <p className={styles.columnError}>{job.error}</p>}
    </details>)}
  </section>;
}

function formatFailureList(items: EvaluationJobResult["failureAnalysis"][number]["missingRelevant"]) {
  return items.length ? items.map(({ candidateName, relevance, rank }) => `${candidateName} (grade ${relevance}${rank ? `, rank ${rank}` : ", not returned"})`).join("; ") : "None";
}

function HistoryMetricComparison({ current, previous }: { current: EvaluationRun; previous: EvaluationHistoryItem }) {
  const currentByKey = new Map(current.series.map((series) => [series.key, series]));
  const pairs = previous.series.flatMap((oldSeries) => {
    const newSeries = currentByKey.get(oldSeries.key);
    return newSeries ? [{ oldSeries, newSeries, deltas: compareSeriesMetrics(oldSeries, newSeries) }] : [];
  });
  if (!pairs.length) return <p className={styles.emptyCompare}>No series keys match. Compare the aggregate tables in each run; strategy or ranking configuration names changed.</p>;
  return <div className={styles.tableWrap}><table className={styles.smallTable}><thead><tr><th>Series</th><th>K</th><th>Δ P@K</th><th>Δ R@K</th><th>Δ NDCG@K</th><th>Δ MRR</th></tr></thead><tbody>
    {pairs.flatMap(({ oldSeries, deltas }) => deltas.map((delta) => <tr key={`${oldSeries.key}/${delta.k}`}><td>{oldSeries.key}</td><td>{delta.k}</td><td>{signed(delta.precisionAtKDelta)}</td><td>{signed(delta.recallAtKDelta)}</td><td>{signed(delta.ndcgAtKDelta)}</td><td>{signed(delta.mrrDelta)}</td></tr>))}
  </tbody></table></div>;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(3)}`;
}

function formatRunDate(value: string) {
  return `${value.slice(0, 16).replace("T", " ")} UTC`;
}
