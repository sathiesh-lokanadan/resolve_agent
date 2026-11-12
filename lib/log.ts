/**
 * Structured, one-line JSON logs for the server. They hold metadata only (ids, tool names,
 * statuses, timings, counts). Never ticket text, tool arguments, answers or API keys.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(event: string, fields: LogFields = {}, level: "info" | "warn" | "error" = "info") {
  if (process.env.RESOLVE_LOG === "off" || process.env.VITEST) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}
