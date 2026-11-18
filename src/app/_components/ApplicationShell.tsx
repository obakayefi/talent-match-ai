"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type IconName = "overview" | "matching" | "candidates" | "retrieval" | "evaluation" | "menu" | "collapse";

const navigation = [
  {
    label: "WORKSPACE",
    items: [
      { href: "/", label: "Overview", icon: "overview" as const },
      { href: "/matching", label: "Candidate Matching", icon: "matching" as const },
      { href: "/candidates", label: "Candidate Explorer", icon: "candidates" as const },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { href: "/retrieval", label: "Retrieval Lab", icon: "retrieval" as const },
      { href: "/evaluation", label: "Evaluation Lab", icon: "evaluation" as const },
    ],
  },
];

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/matching": "Candidate Matching",
  "/candidates": "Candidate Explorer",
  "/retrieval": "Retrieval Lab",
  "/evaluation": "Evaluation Lab",
};

function Icon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" width="18" height="18" {...common}>
      {name === "overview" && <><rect x="2.75" y="2.75" width="6" height="6" rx="1.2" /><rect x="11.25" y="2.75" width="6" height="6" rx="1.2" /><rect x="2.75" y="11.25" width="6" height="6" rx="1.2" /><rect x="11.25" y="11.25" width="6" height="6" rx="1.2" /></>}
      {name === "matching" && <><circle cx="8" cy="7" r="3" /><path d="M2.8 16.8a5.2 5.2 0 0 1 10.4 0M14 5.5l1.4 1.4L18 4.3M14.5 13.5l1.3 1.3" /></>}
      {name === "candidates" && <><circle cx="10" cy="6.5" r="3.3" /><path d="M3 17a7 7 0 0 1 14 0M15.5 3.5a3 3 0 0 1 0 5.8" /></>}
      {name === "retrieval" && <><circle cx="8.5" cy="8.5" r="5.4" /><path d="m12.5 12.5 4.2 4.2M6.1 8.5h4.8M8.5 6.1v4.8" /></>}
      {name === "evaluation" && <><path d="M3 16.5h14M4.5 14V9.5M9 14V4.5M13.5 14v-6M17 14V6" /><path d="m3.5 7.5 4-2.2 4.1 2.4 4.8-4" /></>}
      {name === "menu" && <><path d="M3 5.5h14M3 10h14M3 14.5h14" /></>}
      {name === "collapse" && <><rect x="2.75" y="3.25" width="14.5" height="13.5" rx="2" /><path d="M7.5 3.5v13M11 7.5l2.3 2.5-2.3 2.5" /></>}
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = pageTitles[pathname] ?? "Workspace";

  return (
    <div className={`app-shell${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
      {mobileOpen && <button className="mobile-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className="app-sidebar" aria-label="Application sidebar">
        <Link className="sidebar-brand" href="/" onClick={() => setMobileOpen(false)} aria-label="TalentMatch AI overview">
          <span className="brand-mark" aria-hidden="true">tm</span>
          <span className="brand-wordmark">talentmatch<span>.ai</span></span>
        </Link>

        <nav className="sidebar-scroll" aria-label="Main navigation">
          {navigation.map((section) => (
            <section className="nav-section" key={section.label} aria-label={section.label}>
              <h2 className="nav-section-label">{section.label}</h2>
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    className="nav-link"
                    href={item.href}
                    key={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="nav-link-icon"><Icon name={item.icon} /></span>
                    <span className="nav-link-label">{item.label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-title"><i aria-hidden="true" /> Engineering showcase</div>
          <p>Synthetic data · evidence-first design</p>
        </div>
        <div className="sidebar-collapsed-content" aria-hidden="true">TM</div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <button className="header-toggle desktop-toggle" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>
              <Icon name="collapse" />
            </button>
            <button className="header-toggle mobile-menu-toggle" type="button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
              <Icon name="menu" />
            </button>
            <div className="breadcrumb" aria-label="Breadcrumb">
              <span>Workspace</span><span className="breadcrumb-separator" aria-hidden="true">/</span><span className="breadcrumb-current" aria-current="page">{title}</span>
            </div>
          </div>
          <div className="header-right">
            <div className="header-context"><span className="header-context-mark" aria-hidden="true">⌘</span>Technical showcase</div>
          </div>
        </header>
        <main className="workspace-content" id="main-content">{children}</main>
      </div>
    </div>
  );
}
