"use client";

import { useMemo, useState } from "react";
import type { Candidate } from "@/modules/candidates/schema";
import styles from "./CandidateExplorer.module.css";

export default function CandidateExplorer({ candidates, invalidProfiles, unavailable }: { candidates: Candidate[]; invalidProfiles: number; unavailable: boolean }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return candidates;
    return candidates.filter((candidate) => [candidate.name, candidate.headline, candidate.location, ...candidate.skills].join(" ").toLocaleLowerCase().includes(value));
  }, [candidates, query]);
  const selected = filtered.find((candidate) => candidate.id === selectedId) ?? filtered[0];

  if (unavailable) return <section className={`panel ${styles.state}`}><h2>Candidate data unavailable</h2><p>PostgreSQL could not return the candidate records. Check database health and try again.</p></section>;
  return (
    <section className={styles.workspace}>
      <aside className={`panel ${styles.directory}`} aria-label="Candidate directory">
        <label className={styles.search}><span>Search synthetic profiles</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, headline, location, or skill" /></label>
        <div className={styles.directorySummary}><b>{filtered.length}</b><span>of {candidates.length} profiles</span></div>
        <div className={styles.candidateList}>
          {filtered.map((candidate) => <button className={`${styles.candidateOption}${candidate.id === selected?.id ? ` ${styles.selected}` : ""}`} key={candidate.id} type="button" onClick={() => setSelectedId(candidate.id)}>
            <span className={styles.avatar}>{initials(candidate.name)}</span><span className={styles.optionText}><b>{candidate.name}</b><small>{candidate.headline}</small><small>{candidate.location}</small></span><span className={styles.optionArrow}>›</span>
          </button>)}
          {filtered.length === 0 && <p className={styles.empty}>No profiles match that search.</p>}
        </div>
        {invalidProfiles > 0 && <p className={styles.qualityNote} role="status">{invalidProfiles} profile{invalidProfiles === 1 ? " was" : "s were"} excluded because required structured fields failed validation.</p>}
        <p className={styles.syntheticNote}>Synthetic records for engineering demonstration only.</p>
      </aside>

      {selected ? <article className={`panel ${styles.profile}`}>
        <header className={styles.profileHeader}>
          <div><span className={styles.kicker}>SYNTHETIC CANDIDATE · {selected.id}</span><h2>{selected.name}</h2><p>{selected.headline}</p><span className={styles.location}>{selected.location}</span></div>
          <div className={styles.profileMeta}><span>{selected.experience.length} employment records</span><span>{selected.skills.length} listed skills</span></div>
        </header>
        <section className={styles.summary}><h3>Professional summary</h3><p>{selected.professionalSummary}</p></section>
        <section className={styles.section}><SectionHeading title="Skills and interests" count={selected.skills.length} /><div className={styles.tags}>{selected.skills.map((skill) => <span key={skill}>{skill}</span>)}{selected.industries.map((industry) => <span className={styles.industry} key={`industry-${industry}`}>{industry}</span>)}</div><p className={styles.preference}>Work preferences: {selected.workArrangementPreferences.length ? selected.workArrangementPreferences.join(", ") : "Not provided"}</p></section>
        <section className={styles.section}><SectionHeading title="Employment history" count={selected.experience.length} />
          <div className={styles.timeline}>{selected.experience.map((experience) => <article className={styles.experience} key={experience.id}>
            <header><div><h4>{experience.role}</h4><p>{experience.company}</p></div><span>{experience.startDate} – {experience.endDate ?? "Present"}</span></header>
            <p className={styles.experienceDescription}>{experience.description}</p>
            <h5>Responsibilities <small>({experience.responsibilities.length} individual statements)</small></h5>
            <ul>{experience.responsibilities.map((responsibility, index) => <li key={`${experience.id}-responsibility-${index}`}>{responsibility}</li>)}</ul>
            {experience.technologies.length > 0 && <p className={styles.technologies}><b>Technologies:</b> {experience.technologies.join(" · ")}</p>}
            {experience.achievements.length > 0 && <ul className={styles.achievements}>{experience.achievements.map((achievement, index) => <li key={`${experience.id}-achievement-${index}`}>{achievement}</li>)}</ul>}
          </article>)}</div>
        </section>
        {selected.projects.length > 0 && <section className={styles.section}><SectionHeading title="Projects" count={selected.projects.length} /><div className={styles.projectGrid}>{selected.projects.map((project) => <article key={project.id}><h4>{project.name}</h4><p>{project.description}</p>{project.technologies.length > 0 && <small>{project.technologies.join(" · ")}</small>}</article>)}</div></section>}
        <div className={styles.credentialGrid}>
          <section className={styles.section}><SectionHeading title="Education" count={selected.education.length} />{selected.education.length ? <ul>{selected.education.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>Not provided.</p>}</section>
          <section className={styles.section}><SectionHeading title="Certifications" count={selected.certifications.length} />{selected.certifications.length ? <ul>{selected.certifications.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>Not provided.</p>}</section>
        </div>
        <details className={styles.source}><summary>Original profile source text</summary><pre>{selected.originalProfileText}</pre></details>
      </article> : <div className={`panel ${styles.state}`}><h2>No candidate selected</h2><p>Try another search or clear the filter.</p></div>}
    </section>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return <div className={styles.sectionHeading}><h3>{title}</h3><span>{count}</span></div>;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase();
}
