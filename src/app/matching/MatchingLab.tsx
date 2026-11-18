"use client";

import { useState } from "react";
import type { MatchingResponse, RankingWeights } from "@/modules/assessment/schema";
import { ExplanationResponseSchema, type ExplanationResponse } from "@/modules/explanations/schema";
import styles from "./MatchingLab.module.css";

type JobOption = { id: string; title: string };
type RunState = { response?: MatchingResponse; error?: string };
type SignalKey = keyof RankingWeights;

const defaultWeights: RankingWeights = {
  technicalSkills: 30,
  responsibilityAlignment: 30,
  relevantExperience: 20,
  domainRelevance: 10,
  workPreference: 10,
};

const signalLabels: Record<SignalKey, string> = {
  technicalSkills: "Technical skills",
  responsibilityAlignment: "Responsibilities",
  relevantExperience: "Relevant experience",
  domainRelevance: "Domain relevance",
  workPreference: "Work preference",
};

const eligibilitySections = [
  { key: "ELIGIBLE", title: "Eligible", description: "All mandatory requirements have direct supporting evidence." },
  { key: "NEEDS_REVIEW", title: "Needs review", description: "At least one mandatory requirement remains unknown." },
  { key: "NOT_ELIGIBLE", title: "Not eligible", description: "At least one mandatory requirement has explicit counter-evidence." },
] as const;

async function runMatching(input: { jobId: string; strategy: string; topK: number; weights: RankingWeights; asOfDate?: string }): Promise<MatchingResponse> {
  const response = await fetch("/api/matching", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json() as MatchingResponse | { error?: { message?: string } };
  if (!response.ok) throw new Error("error" in payload ? payload.error?.message ?? "Matching failed." : "Matching failed.");
  return payload as MatchingResponse;
}

export default function MatchingLab({ jobs }: { jobs: JobOption[] }) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [strategy, setStrategy] = useState("lexical");
  const [topK, setTopK] = useState(10);
  const [asOfDate, setAsOfDate] = useState("");
  const [weights, setWeights] = useState(defaultWeights);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState<RunState>();

  function updateWeight(key: SignalKey, value: number) {
    setWeights((previous) => ({ ...previous, [key]: Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) }));
  }

  async function execute() {
    setLoading(true);
    setRun(undefined);
    try {
      setRun({ response: await runMatching({ jobId, strategy, topK, weights, ...(asOfDate ? { asOfDate } : {}) }) });
    } catch (error) {
      setRun({ error: error instanceof Error ? error.message : "Matching failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.lab}>
      <section className={`panel ${styles.controls}`} aria-label="Matching run configuration">
        <label className={styles.control}><span>Job description</span><select disabled={loading} value={jobId} onChange={(event) => { setJobId(event.target.value); setRun(undefined); }}>
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </select></label>
        <label className={styles.control}><span>Retrieval strategy</span><select disabled={loading} value={strategy} onChange={(event) => setStrategy(event.target.value)}>
          <option value="lexical">Lexical</option><option value="semantic">Semantic</option><option value="hybrid">Hybrid · RRF</option>
        </select></label>
        <label className={styles.control}><span>Top K</span><input disabled={loading} type="number" min={1} max={20} value={topK} onChange={(event) => setTopK(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
        <label className={styles.control}><span>Assessment date</span><input disabled={loading} type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} /></label>
        <div className={styles.action}><button className="button-primary" type="button" disabled={loading || !jobId} onClick={execute}>{loading ? "Assessing…" : "Run assessment"}</button></div>

        <details className={styles.weights} open={weightsOpen} onToggle={(event) => setWeightsOpen(event.currentTarget.open)}>
          <summary>Scoring weights <span>Defaults total 100%</span></summary>
          <div className={styles.weightGrid}>{(Object.keys(signalLabels) as SignalKey[]).map((key) => <label key={key}>
            <span>{signalLabels[key]}</span><div><input disabled={loading} type="number" min={0} max={100} value={weights[key]} onChange={(event) => updateWeight(key, Number(event.target.value))} /><small>%</small></div>
          </label>)}</div>
          <p>Weights are normalized to 100% at run time. Unknown signals keep a fixed neutral score of 50 and their configured weight.</p>
        </details>
      </section>

      <p className={styles.policy}>Eligibility is evidence-based and independent from suitability. Missing facts remain unknown; candidates are bucketed by eligibility before score ordering.</p>
      {run?.error && <div className={styles.error} role="alert"><strong>Assessment could not run.</strong><span>{run.error}</span><small>Lexical retrieval remains available if Ollama is offline.</small></div>}
      {run?.response && <RunResults response={run.response} />}
      {!run && !loading && <div className={`panel ${styles.empty}`}><span aria-hidden="true">✳</span><h2>Assess the candidate pool</h2><p>Choose a job and run lexical, semantic, or hybrid retrieval before evidence assessment and ranking.</p></div>}
      {loading && <p className={styles.progress} role="status">Retrieving candidates and evaluating structured profile evidence…</p>}
    </div>
  );
}

function RunResults({ response }: { response: MatchingResponse }) {
  return (
    <section className={styles.output} aria-live="polite">
      <header className={styles.runHeader}>
        <div><span className={styles.kicker}>MATCHING RUN</span><h2>{response.job.title}</h2><p>Run {response.runId} · {new Date(response.createdAt).toLocaleString()}</p><a className={styles.runInspection} href={`/api/matching?runId=${encodeURIComponent(response.runId)}`} target="_blank" rel="noreferrer">Inspect saved run trace ↗</a></div>
        <div className={styles.runFacts}><span>{response.retrieval.requestedStrategy === response.retrieval.strategy ? `${response.retrieval.strategy} retrieval` : `${response.retrieval.requestedStrategy} requested · ${response.retrieval.strategy} used`}</span><span>Top {response.retrieval.topK}</span><span>{response.durationMs === null ? "Duration unavailable" : `${response.durationMs} ms`}</span><span>As of {response.assessmentDate}</span></div>
      </header>
      {response.retrieval.degraded && <div className={styles.degradedNotice} role="status"><b>Degraded retrieval</b><span>{response.retrieval.fallbackReason}</span></div>}
      {response.dataQuality && (response.dataQuality.invalidProfilesSkipped > 0 || response.dataQuality.retrievedProfilesSkipped > 0) && <div className={styles.dataQualityNotice} role="status">Some profiles were excluded: {response.dataQuality.invalidProfilesSkipped} invalid profile{response.dataQuality.invalidProfilesSkipped === 1 ? "" : "s"}, {response.dataQuality.retrievedProfilesSkipped} retrieval result{response.dataQuality.retrievedProfilesSkipped === 1 ? "" : "s"} without valid assessment data.</div>}
      <div className={styles.bucketPolicy}>Order: eligible → needs review → not eligible; suitability score sorts candidates within each section. Suitability never overrides a failed mandatory requirement.</div>
      {eligibilitySections.map((section) => {
        const candidates = response.candidates.filter((candidate) => candidate.eligibility.classification === section.key);
        return <section className={styles.bucket} key={section.key} aria-label={`${section.title} candidates`}>
          <header className={styles.bucketHeader}><div><h3>{section.title}</h3><p>{section.description}</p></div><span>{candidates.length}</span></header>
          {candidates.length === 0 ? <p className={styles.noCandidates}>No candidates in this section.</p> : <div className={styles.candidates}>{candidates.map((candidate) => <CandidateAssessment key={candidate.candidateId} candidate={candidate} jobId={response.job.id} matchRunId={response.runId} />)}</div>}
        </section>;
      })}
      <details className={styles.runConfig}><summary>Recorded ranking configuration</summary><pre>{JSON.stringify({ normalizedWeights: response.normalizedWeights, topK: response.retrieval.topK, retrievalStrategy: response.retrieval.strategy, assessmentDate: response.assessmentDate, unknownSignalScore: 50 }, null, 2)}</pre></details>
    </section>
  );
}

function CandidateAssessment({ candidate, jobId, matchRunId }: { candidate: MatchingResponse["candidates"][number]; jobId: string; matchRunId: string }) {
  const [explanation, setExplanation] = useState<ExplanationResponse>();
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string>();

  async function generateExplanation() {
    setLoadingExplanation(true);
    setExplanationError(undefined);
    try {
      const response = await fetch("/api/explanations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchRunId, candidateId: candidate.candidateId, jobId }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok) throw new Error("The saved candidate assessment could not be loaded.");
      setExplanation(ExplanationResponseSchema.parse(payload));
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : "Explanation generation failed.");
    } finally {
      setLoadingExplanation(false);
    }
  }

  return (
    <article className={`panel ${styles.card}`}>
      <header className={styles.cardHeader}>
        <span className={styles.rank}>#{String(candidate.rank).padStart(2, "0")}<small>retrieved #{candidate.retrieval.rank}</small></span>
        <div className={styles.identity}><h4>{candidate.candidateName}</h4><p>{candidate.headline} <span>·</span> {candidate.candidateId}</p></div>
        <div className={styles.score}><span>Suitability score</span><strong>{candidate.suitabilityScore.toFixed(2)}</strong><small>/ 100</small></div>
        <span className={`${styles.badge} ${styles[candidate.eligibility.classification.toLowerCase()]}`}>{candidate.eligibility.classification.replaceAll("_", " ")}</span>
      </header>
      <p className={styles.eligibilityReason}>{candidate.eligibility.reasoning}</p>

      <section className={styles.signals} aria-label="Ranking signal breakdown">
        {candidate.signals.map((item) => <div className={styles.signal} key={item.key}>
          <div className={styles.signalTop}><b>{item.label}</b><span>{item.score.toFixed(1)} <small>/ 100</small></span></div>
          <div className={styles.track}><i style={{ width: `${item.score}%` }} /></div>
          <div className={styles.signalMeta}><span>{item.weight.toFixed(1)}% weight</span><span>+{item.weightedContribution.toFixed(2)} points</span><span>{item.status === "UNKNOWN" ? "Unknown · neutral 50" : item.status}</span></div>
        </div>)}
      </section>

      <div className={styles.explanationGrid}>
        <ExplanationList title="Strengths" items={candidate.strengths} />
        <ExplanationList title="Gaps" items={candidate.gaps} />
        <ExplanationList title="Unknowns" items={candidate.unknowns} />
      </div>

      <section className={styles.aiExplanation} aria-label={`Evidence explanation for ${candidate.candidateName}`}>
        <div className={styles.aiExplanationHeader}>
          <div><h5>Evidence grounded explanation</h5><p>Explains the saved score and eligibility. It cannot change either decision.</p></div>
          <button className="outline-button" type="button" disabled={loadingExplanation} onClick={generateExplanation}>
            {loadingExplanation ? "Generating…" : explanation ? "Regenerate explanation" : "Generate explanation"}
          </button>
        </div>
        {explanationError && <p className={styles.explanationError} role="alert">{explanationError}</p>}
        {loadingExplanation && <p className={styles.explanationProgress} role="status">Preparing an explanation from verified evidence…</p>}
        {explanation && <div className={styles.generatedExplanation}>
          <p className={styles.explanationSource}>{explanation.source === "ollama" ? "AI generated · evidence validated" : `Deterministic fallback${explanation.fallbackReason ? ` · ${explanation.fallbackReason.replaceAll("_", " ")}` : " · model not configured"}`}</p>
          <article><b>Candidate summary</b><p>{explanation.explanation.candidateSummary.text}</p><EvidenceBadges ids={explanation.explanation.candidateSummary.evidenceIds} /></article>
          <article><b>Overall assessment</b><p>{explanation.explanation.overallAssessment.text}</p><EvidenceBadges ids={explanation.explanation.overallAssessment.evidenceIds} /></article>
          <div className={styles.generatedColumns}>
            <GeneratedClaims title="Strengths" items={explanation.explanation.strengths} />
            <GeneratedClaims title="Gaps" items={explanation.explanation.gaps} />
            <GeneratedClaims title="Unknowns" items={explanation.explanation.unknowns} />
          </div>
          <details className={styles.generatedRequirements}>
            <summary>Requirement explanations <span>{explanation.explanation.requirementExplanations.length} requirements · deterministic statuses preserved</span></summary>
            {explanation.explanation.requirementExplanations.map((item) => <article key={item.requirementId}>
              <div><b>{candidate.eligibility.requirements.find((requirement) => requirement.requirementId === item.requirementId)?.description ?? item.requirementId}</b><span>{item.status}</span></div>
              <p>{item.explanation}</p><EvidenceBadges ids={item.evidenceIds} />
            </article>)}
          </details>
          <details className={styles.evidenceIndex}><summary>Evidence references ({explanation.explanation.evidenceReferences.length})</summary><ul>{explanation.explanation.evidenceReferences.map((id) => <li key={id}><code>{id}</code></li>)}</ul></details>
        </div>}
      </section>

      <details className={styles.requirements}>
        <summary>Requirement assessment <span>{candidate.eligibility.requirements.filter((item) => item.requirementType === "mandatory").length} mandatory · {candidate.eligibility.requirements.filter((item) => item.requirementType === "preferred").length} preferred</span></summary>
        <div className={styles.requirementList}>{candidate.eligibility.requirements.map((requirement) => <article className={styles.requirement} key={requirement.requirementId}>
          <div className={styles.requirementHeader}><b>{requirement.description}</b><span className={`${styles.requirementStatus} ${styles[requirement.status.toLowerCase()]}`}>{requirement.status}</span><small>{requirement.requirementType}</small></div>
          <p>{requirement.reasoning}</p>
          {requirement.evidence.map((item) => <blockquote key={item.sourceReference}><span>{item.support}</span> “{item.supportingText}” <code>{item.sourceReference}</code></blockquote>)}
        </article>)}</div>
      </details>
    </article>
  );
}

function EvidenceBadges({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <small className={styles.noEvidence}>No positive evidence recorded; treated as unknown.</small>;
  return <div className={styles.evidenceBadges}>{ids.map((id) => <code key={id}>{id}</code>)}</div>;
}

function GeneratedClaims({ title, items }: { title: string; items: ExplanationResponse["explanation"]["strengths"] }) {
  return <section><h6>{title}</h6>{items.length === 0 ? <p>None provided.</p> : items.map((item, index) => <article key={`${item.text}-${index}`}><p>{item.text}</p><EvidenceBadges ids={item.evidenceIds} /></article>)}</section>;
}

function ExplanationList({ title, items }: { title: string; items: string[] }) {
  return <section className={styles.explanation}><h5>{title}</h5>{items.length === 0 ? <p>None established.</p> : <ul>{items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>}</section>;
}
