import Link from "next/link";
import PageHeader from "@/app/_components/PageHeader";
import { EmptyState, MetricCard, SectionHeading } from "@/app/_components/OverviewComponents";
import { getOverviewSnapshot } from "@/modules/overview/service";
import styles from "./Overview.module.css";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const snapshot = await getOverviewSnapshot();
  const available = snapshot.status === "available";
  const recentRuns = available ? snapshot.recentRuns : [];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Talent intelligence · Overview"
        title="Make every signal count."
        description="A technical showcase for exploring candidate data, retrieval methods, and evidence-based evaluation in one workspace."
        action={<div className={styles.headerActions}>
          <Link className="button-secondary" href="/candidates">Explore candidates</Link>
          <Link className="button-primary" href="/matching"><span className="button-icon" aria-hidden="true">↗</span>Open matching</Link>
        </div>}
      />

      <section aria-label="Workspace metrics" className={styles.metrics}>
        <MetricCard
          detail={available ? "Profiles in the current dataset" : "Database connection unavailable"}
          icon="◉"
          label="Candidate profiles"
          unavailable={!available}
          value={available ? snapshot.candidateCount.toLocaleString() : "—"}
        />
        <MetricCard
          detail={available ? "Job records in the current dataset" : "Database connection unavailable"}
          icon="⌑"
          label="Jobs in dataset"
          unavailable={!available}
          value={available ? snapshot.jobCount.toLocaleString() : "—"}
        />
        <MetricCard
          detail={available ? "Recorded match runs" : "Database connection unavailable"}
          icon="⌁"
          label="Matching activity"
          unavailable={!available}
          value={available ? snapshot.matchRunCount.toLocaleString() : "—"}
        />
      </section>

      {!available && <p className={styles.databaseNote} role="status">The overview remains available. Start PostgreSQL and apply migrations to load current dataset counts.</p>}

      <section className={styles.pipelineSection} aria-labelledby="pipeline-title">
        <SectionHeading
          titleId="pipeline-title"
          title="The intelligence pipeline"
          description="A planned workflow for moving from source profiles to measurable, reviewable matches."
          aside={<span className="section-kicker">PLANNED SYSTEM</span>}
        />
        <div className={`panel ${styles.pipelinePanel}`}>
          <div className={styles.pipelineIntro}>
            <div className={styles.pipelineIntroIcon} aria-hidden="true">⌘</div>
            <div><strong>From source data to measurable matches</strong><p>Each stage is designed to leave a clear trail from query to evidence and evaluation.</p></div>
          </div>
          <ol className={styles.pipeline} aria-label="Planned intelligence pipeline">
            {[
              ["01", "Source profiles", "Structured data"],
              ["02", "Candidate retrieval", "Hybrid search"],
              ["03", "Eligibility review", "Requirement checks"],
              ["04", "Deterministic rank", "Signal aggregation"],
              ["05", "Evidence review", "Grounded rationale"],
              ["06", "Ranking evaluation", "Offline metrics"],
            ].map(([number, title, description], index) => (
              <li className={styles.pipelineStep} key={number}>
                {index > 0 && <span className={styles.pipelineConnector} aria-hidden="true" />}
                <span className={styles.pipelineNumber}>{number}</span>
                <strong>{title}</strong>
                <span className={styles.pipelineDescription}>{description}</span>
                <span className={styles.plannedBadge}>Planned</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className={styles.lowerGrid}>
        <section className={styles.exploreSection} aria-labelledby="explore-title">
          <SectionHeading titleId="explore-title" title="Explore the workspace" description="Move between the areas of the showcase." />
          <div className={styles.exploreGrid}>
            {[
              { href: "/matching", number: "01", title: "Candidate matching", description: "A future workspace for comparing role requirements with candidate evidence.", icon: "↗" },
              { href: "/candidates", number: "02", title: "Candidate explorer", description: "Inspect the synthetic profile dataset and its structured fields.", icon: "◉" },
              { href: "/retrieval", number: "03", title: "Retrieval lab", description: "Compare keyword, semantic, and hybrid retrieval approaches.", icon: "⌕" },
              { href: "/evaluation", number: "04", title: "Evaluation lab", description: "Review relevance judgments and ranking evaluation methods.", icon: "⌁" },
            ].map((item) => (
              <Link className={styles.exploreCard} href={item.href} key={item.href}>
                <span className={styles.exploreIcon} aria-hidden="true">{item.icon}</span>
                <span className={styles.exploreBody}><span className={styles.exploreNumber}>{item.number} / WORKSPACE</span><strong>{item.title}</strong><span className={styles.exploreDescription}>{item.description}</span></span>
                <span className={styles.exploreArrow} aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.activitySection} aria-labelledby="activity-title">
          <SectionHeading titleId="activity-title" title="Recent activity" description="Recorded matching runs from this dataset." aside={<span className="section-kicker">LATEST 4</span>} />
          <div className={`panel ${styles.activityPanel}`}>
            {recentRuns.length === 0 ? (
              <EmptyState
                description={available ? "No match runs have been recorded yet. When a real run is created, it will appear here." : "Activity will appear here when the database is connected and a real run has been recorded."}
                icon="⌁"
                title="No recorded activity"
              />
            ) : (
              <ul className={styles.activityList}>
                {recentRuns.map((run) => (
                  <li className={styles.activityItem} key={run.id}>
                    <span className={styles.activityMark} aria-hidden="true">↗</span>
                    <div className={styles.activityBody}>
                      <strong>{run.job.title}</strong>
                      <span>{run.retrievalMethod}{run.embeddingModel ? ` · ${run.embeddingModel}` : ""}</span>
                    </div>
                    <time className="mono" dateTime={run.createdAt.toISOString()}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(run.createdAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!available && <p className={styles.activityFootnote}>Database status is unavailable; activity is not inferred.</p>}
        </section>
      </div>

      <footer className={styles.pageFooter}>
        <span>TalentMatch AI <i>·</i> Technical showcase</span>
        <span>Example profiles are synthetic.</span>
      </footer>
    </div>
  );
}
