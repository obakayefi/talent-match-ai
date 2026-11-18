type LogLevel = "info" | "warn" | "error";
type LogValue = string | number | boolean | undefined;

/** Emits one structured JSON record without profile text, prompt content, or secrets. */
export function logEvent(level: LogLevel, event: string, attributes: Record<string, LogValue> = {}): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined)),
  };
  console[level](JSON.stringify(record));
}
