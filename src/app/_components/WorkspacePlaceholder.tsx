import Link from "next/link";
import PageHeader from "./PageHeader";
import styles from "./WorkspacePlaceholder.module.css";

export default function WorkspacePlaceholder({
  eyebrow,
  title,
  description,
  purpose,
  plannedWork,
}: {
  eyebrow: string;
  title: string;
  description: string;
  purpose: string;
  plannedWork: string[];
}) {
  return (
    <div className={styles.page}>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className={`panel ${styles.placeholder}`} aria-labelledby="planned-work-title">
        <div className={styles.icon} aria-hidden="true">⌘</div>
        <span className={styles.phase}>PLANNED WORKSPACE</span>
        <h2 id="planned-work-title">A clear place for the next layer.</h2>
        <p className={styles.purpose}>{purpose}</p>
        <div className={styles.workBlock}>
          <h3>Intended scope</h3>
          <ul>{plannedWork.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className={styles.actions}>
          <Link className="button-secondary" href="/">Return to overview</Link>
          <span className={styles.disclaimer}>This area does not run matching or AI operations yet.</span>
        </div>
      </section>
    </div>
  );
}
