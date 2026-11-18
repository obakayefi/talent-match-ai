"use client";

import { useState } from "react";
import type { RetrievalResponse, RetrievalStrategy } from "@/modules/retrieval/schema";
import styles from "./RetrievalLab.module.css";

type JobOption = { id: string; title: string };
type RunState = { response?: RetrievalResponse; error?: string };

const strategies: RetrievalStrategy[] = ["lexical", "semantic", "hybrid"];
const labels: Record<RetrievalStrategy, string> = { lexical: "Lexical", semantic: "Semantic", hybrid: "Hybrid · RRF" };

async function execute(jobId: string, strategy: RetrievalStrategy, topK: number): Promise<RetrievalResponse> {
  const response = await fetch("/api/retrieval", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId, strategy, topK }),
  });
  const payload = await response.json() as RetrievalResponse | { error?: { message?: string } };
  if (!response.ok) throw new Error("error" in payload ? payload.error?.message ?? "Retrieval failed." : "Retrieval failed.");
  return payload as RetrievalResponse;
}

export default function RetrievalLab({ jobs }: { jobs: JobOption[] }) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [strategy, setStrategy] = useState<RetrievalStrategy>("lexical");
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [singleRun, setSingleRun] = useState<RunState>();
  const [comparison, setComparison] = useState<Partial<Record<RetrievalStrategy, RunState>>>({});

  async function runSingle() {
    setLoading(true);
    setSingleRun(undefined);
    try {
      setSingleRun({ response: await execute(jobId, strategy, topK) });
    } catch (error) {
      setSingleRun({ error: error instanceof Error ? error.message : "Retrieval failed." });
    } finally {
      setLoading(false);
    }
  }

  async function compareStrategies() {
    setLoading(true);
    setSingleRun(undefined);
    setComparison({});
    for (const item of strategies) {
      try {
        const response = await execute(jobId, item, topK);
        setComparison((previous) => ({ ...previous, [item]: { response } }));
      } catch (error) {
        setComparison((previous) => ({ ...previous, [item]: { error: error instanceof Error ? error.message : "Retrieval failed." } }));
      }
    }
    setLoading(false);
  }

  function changeJob(value: string) {
    setJobId(value);
    setSingleRun(undefined);
    setComparison({});
  }

  return (
    <div className={styles.lab}>
      <section className={`panel ${styles.controls}`} aria-label="Retrieval configuration">
        <label className={styles.control}>
          <span>Job description</span>
          <select disabled={loading} value={jobId} onChange={(event) => changeJob(event.target.value)}>
            {jobs.map((job) => <option value={job.id} key={job.id}>{job.title}</option>)}
          </select>
        </label>
        <label className={styles.control}>
          <span>Strategy</span>
          <select disabled={loading} value={strategy} onChange={(event) => setStrategy(event.target.value as RetrievalStrategy)}>
            {strategies.map((item) => <option value={item} key={item}>{labels[item]}</option>)}
          </select>
        </label>
        <label className={`${styles.control} ${styles.topK}`}>
          <span>Top K</span>
          <input disabled={loading} type="number" min={1} max={20} value={topK} onChange={(event) => setTopK(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} />
        </label>
        <div className={styles.actions}>
          <button className="button-primary" type="button" disabled={loading || !jobId} onClick={runSingle}>
            {loading ? "Running…" : "Run retrieval"}
          </button>
          <button className="button-secondary" type="button" disabled={loading || !jobId} onClick={compareStrategies}>
            Compare all
          </button>
        </div>
      </section>

      <p className={styles.note}>Lexical scores, cosine similarities, and RRF scores have different meanings. Compare candidates and ranks within each strategy; raw score values are not cross-strategy quality measures.</p>

      {singleRun && <RunPanel state={singleRun} />}
      {Object.keys(comparison).length > 0 && (
        <section className={styles.comparison} aria-label="Strategy comparison" aria-live="polite">
          {strategies.map((item) => <RunColumn key={item} strategy={item} state={comparison[item]} />)}
        </section>
      )}
      {!singleRun && Object.keys(comparison).length === 0 && !loading && (
        <div className={`panel ${styles.empty}`}>
          <span className={styles.emptyMark} aria-hidden="true">⌕</span>
          <h2>Run a retrieval experiment</h2>
          <p>Choose a job and strategy to see real candidate matches, source evidence, ranks, and scores.</p>
        </div>
      )}
      {loading && Object.keys(comparison).length === 0 && !singleRun && <p className={styles.progress} role="status">Executing retrieval. Semantic runs may first prepare candidate evidence embeddings.</p>}
    </div>
  );
}

function RunPanel({ state }: { state: RunState }) {
  if (state.error) return <div className={styles.error} role="alert"><strong>Retrieval could not run.</strong><span>{state.error}</span><small>Lexical retrieval remains available even if the embedding provider is offline.</small></div>;
  if (!state.response) return null;
  const response = state.response;
  return (
    <section className={styles.output} aria-live="polite">
      <RunSummary response={response} />
      <details className={styles.queryDetails}><summary>Inspect structured job query ({response.query.segmentCount} segments)</summary><pre>{response.query.text}</pre></details>
      <div className={styles.results}>
        {response.candidates.map((candidate) => <CandidateResult key={candidate.candidateId} result={candidate} />)}
        {response.candidates.length === 0 && <div className={`panel ${styles.empty}`}><h2>No candidates retrieved</h2><p>This strategy returned an empty result set for the selected job.</p></div>}
      </div>
    </section>
  );
}

function RunSummary({ response }: { response: RetrievalResponse }) {
  return (
    <div className={styles.summary}>
      <div><span className={styles.kicker}>SEARCH RUN</span><h2>{response.job.title}</h2></div>
      <div className={styles.runFacts}>
        <span>{labels[response.strategy]}</span><span>Top {response.topK}</span><span>{response.durationMs} ms</span>
        {response.metadata.model && <span>{response.metadata.model} · {response.metadata.dimensions}d</span>}
        {response.metadata.modelVersion && <span title={response.metadata.modelVersion}>model digest · {response.metadata.modelVersion.slice(0, 18)}…</span>}
        {response.metadata.rrfConstant && <span>RRF k={response.metadata.rrfConstant}</span>}
      </div>
      <p className={styles.runId}>Run {response.runId}</p>
    </div>
  );
}

function CandidateResult({ result }: { result: RetrievalResponse["candidates"][number] }) {
  return (
    <article className={`panel ${styles.candidate}`}>
      <div className={styles.candidateHead}>
        <span className={styles.rank}>#{String(result.rank).padStart(2, "0")}</span>
        <div className={styles.identity}><h3>{result.candidateName}</h3><p>{result.headline}</p><small>{result.candidateId}</small></div>
        <div className={styles.score}><span>{result.strategy === "lexical" ? "FTS score" : result.strategy === "semantic" ? "Cosine similarity" : "RRF score"}</span><strong>{result.score.toFixed(5)}</strong></div>
      </div>
      {result.strategy === "hybrid" && <div className={styles.breakdown}>
        <span>Lexical rank {result.strategyRanks.lexical ?? "—"} · raw {result.strategyScores.lexical?.toFixed(5) ?? "—"} · RRF +{result.contributions.lexical?.toFixed(5) ?? "0"}</span>
        <span>Semantic rank {result.strategyRanks.semantic ?? "—"} · raw {result.strategyScores.semantic?.toFixed(5) ?? "—"} · RRF +{result.contributions.semantic?.toFixed(5) ?? "0"}</span>
      </div>}
      <div className={styles.evidence}>
        <h4>Matched source content</h4>
        {result.matchedContent.map((content, index) => <blockquote key={`${result.evidenceReferences[index] ?? index}-${index}`}>{content}</blockquote>)}
        <div className={styles.references}><span>Evidence references</span>{result.evidenceReferences.map((reference) => <code key={reference}>{reference}</code>)}</div>
      </div>
    </article>
  );
}

function RunColumn({ strategy, state }: { strategy: RetrievalStrategy; state?: RunState }) {
  return (
    <section className={styles.column} aria-label={`${labels[strategy]} results`}>
      <header><h2>{labels[strategy]}</h2>{state?.response && <span>{state.response.durationMs} ms · {state.response.candidates.length} results</span>}</header>
      {!state && <p className={styles.progress}>Waiting…</p>}
      {state?.error && <p className={styles.columnError} role="alert">{state.error}</p>}
      {state?.response?.candidates.map((candidate) => <article className={styles.miniResult} key={candidate.candidateId}>
        <div><b>#{candidate.rank} {candidate.candidateName}</b><span>{candidate.headline}</span></div>
        <strong>{candidate.score.toFixed(5)}</strong>
        {candidate.strategy === "hybrid" && <small>Lexical #{candidate.strategyRanks.lexical ?? "—"} · Semantic #{candidate.strategyRanks.semantic ?? "—"}</small>}
        {candidate.matchedContent[0] && <blockquote>{candidate.matchedContent[0]}</blockquote>}
      </article>)}
      {state?.response && state.response.candidates.length === 0 && <p className={styles.progress}>No matches returned.</p>}
    </section>
  );
}
