const canonicalNames: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  postgres: "PostgreSQL",
  ml: "Machine Learning",
  rag: "Retrieval-Augmented Generation",
};

export function canonicalSkillName(name: string) {
  return canonicalNames[name.trim().toLocaleLowerCase()] ?? name.trim();
}
