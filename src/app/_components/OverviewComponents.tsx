import type { ReactNode } from "react";
import styles from "../Overview.module.css";

export function SectionHeading({
  title,
  titleId,
  description,
  aside,
}: {
  title: string;
  titleId?: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
      {aside}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  unavailable = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
  unavailable?: boolean;
}) {
  return (
    <article className={`panel ${styles.metricCard}${unavailable ? ` ${styles.metricUnavailable}` : ""}`}>
      <div className={styles.metricCardTop}><span className={styles.metricIcon} aria-hidden="true">{icon}</span><span className={styles.metricLabel}>{label}</span></div>
      <div className={`${styles.metricValue} mono`}>{value}</div>
      <p className={styles.metricDetail}>{detail}</p>
    </article>
  );
}

export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className={styles.emptyState} role="status">
      <span className={styles.emptyStateIcon} aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
