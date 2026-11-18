"use client";

import { useMemo, useState } from "react";
import type { Candidate } from "@/modules/candidates/schema";
import type { Job } from "@/modules/jobs/schema";

const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("");
const palette = ["lavender", "mint", "peach", "blue", "rose"];

type MatchingWorkspaceProps = {
  candidates: Candidate[];
  jobs: Job[];
};

export default function MatchingWorkspace({ candidates, jobs }: MatchingWorkspaceProps) {
  const [activeJobId, setActiveJobId] = useState(jobs[0].id);
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("All skills");
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? jobs[0];
  const skills = useMemo(() => ["All skills", ...new Set(candidates.flatMap((candidate) => candidate.skills))].sort((a, b) => a === "All skills" ? -1 : a.localeCompare(b)), [candidates]);
  const visibleCandidates = useMemo(() => candidates.filter((candidate) => {
    const text = `${candidate.name} ${candidate.professionalSummary} ${candidate.skills.join(" ")} ${candidate.industries.join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (skill === "All skills" || candidate.skills.includes(skill));
  }), [candidates, query, skill]);

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="TalentMatch home"><span className="brand-mark">t<span>m</span></span><span>talentmatch<span className="brand-ai">.ai</span></span></a>
        <div className="side-label">WORKSPACE</div>
        <a className="nav-item active" href="#jobs"><span className="nav-icon">◫</span> Matching workspace <span className="nav-chevron">›</span></a>
        <a className="nav-item muted" href="#candidates"><span className="nav-icon">◉</span> Candidate pool</a>
        <a className="nav-item muted" href="#evaluation"><span className="nav-icon">⌁</span> Evaluation <span className="soon">SOON</span></a>
        <div className="sidebar-bottom"><div className="sidebar-note-icon">✳</div><div><strong>Built for better matches</strong><p>Explore how search signals can reveal more than keywords.</p></div><a href="#about" aria-label="About this demo">↗</a></div>
        <div className="profile"><div className="profile-avatar">TM</div><div><strong>TalentMatch demo</strong><span>Sample workspace</span></div><span className="more">···</span></div>
      </aside>

      <section className="main-content" id="top">
        <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>Matching workspace</strong></div><div className="top-actions"><span className="environment"><i /> Synthetic data</span><button className="help-button" aria-label="Help">?</button><div className="top-avatar">TM</div></div></header>
        <div className="page-content">
          <div className="intro-row"><div><div className="eyebrow"><span className="spark">✳</span> INTELLIGENCE WORKSPACE</div><h1>Find the right signal.</h1><p className="subtitle">Explore candidate profiles against real-world role requirements.</p></div><button className="dataset-button"><span>▤</span> Demo dataset <span className="caret">⌄</span></button></div>

          <section className="job-section" id="jobs">
            <div className="section-heading"><div><h2>Choose a role</h2><p>Select a job to explore its candidate pool.</p></div><span className="count-pill">{jobs.length} OPEN ROLES</span></div>
            <div className="job-grid">{jobs.map((job, index) => <button className={`job-card ${activeJobId === job.id ? "selected" : ""}`} key={job.id} onClick={() => setActiveJobId(job.id)}>
              <div className={`company-mark mark-${index}`}>{["cl", "ml", "sr", "dt", "pd"][index]}</div><div className="job-card-copy"><h3>{job.title}</h3><p>{job.company} <span>·</span> {job.location}</p></div><span className="job-arrow">↗</span>
            </button>)}</div>
          </section>

          <section className="candidate-section" id="candidates">
            <div className="section-heading candidates-heading"><div><div className="role-label">SELECTED ROLE <span>·</span> {activeJob.industry.toUpperCase()}</div><h2>{activeJob.title}</h2><p>{activeJob.description}</p></div><button className="outline-button" title="Matching becomes available in a later milestone"><span>✳</span> Run matching <span className="lock">⌑</span></button></div>
            <div className="candidate-toolbar"><div><h3>Candidate pool <span>{visibleCandidates.length}</span></h3><p>Browse the synthetic profiles available for this role.</p></div><div className="filters"><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates" aria-label="Search candidates" /></label><label className="select-wrap"><select value={skill} onChange={(event) => setSkill(event.target.value)} aria-label="Filter by skill">{skills.map((item) => <option key={item}>{item}</option>)}</select></label></div></div>
            <div className="candidate-list">{visibleCandidates.map((candidate, index) => <article className="candidate-card" key={candidate.id}><div className={`candidate-avatar ${palette[index % palette.length]}`}>{initials(candidate.name)}</div><div className="candidate-main"><div className="candidate-name-row"><h4>{candidate.name}</h4><span className="location">⌖ {candidate.location}</span><span className="profile-tag">PROFILE</span></div><p className="candidate-summary">{candidate.professionalSummary}</p><div className="skill-list">{candidate.skills.slice(0, 4).map((item) => <span key={item}>{item}</span>)}{candidate.skills.length > 4 && <span className="extra-skill">+{candidate.skills.length - 4}</span>}</div></div><button className="view-button" aria-label={`View ${candidate.name} profile`} title="Profile detail is planned for a later milestone">↗</button></article>)}{visibleCandidates.length === 0 && <div className="empty-state">No profiles match those filters. Try another name or skill.</div>}</div>
            <div className="list-footer">Showing <strong>{visibleCandidates.length}</strong> of {candidates.length} synthetic profiles <span>Profile details available in a later milestone</span></div>
          </section>
          <footer className="footer" id="about"><span>TalentMatch AI <b>·</b> Engineering showcase</span><span>Candidate profiles are synthetic <b>·</b> No matching scores have been computed</span></footer>
        </div>
      </section>
    </main>
  );
}
