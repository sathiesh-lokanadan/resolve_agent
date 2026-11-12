// promptfoo reads { output, error } from what this returns, so the result goes under `output`.
// (Returning the fields at the top level makes promptfoo report "No output" on every successful call.)
// Turns the NDJSON stream from POST /api/resolve into the object the assertions read.
module.exports = (json, text) => {
  const events = String(text)
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const starts = {};
  for (const e of events) if (e.type === "tool_start") starts[e.id] = e.args;
  const calls = events
    .filter((e) => e.type === "tool_end")
    .map((e) => ({ name: e.name, status: e.result.status, args: starts[e.id] || {}, result: e.result }));
  const answer = (events.find((e) => e.type === "answer") || {}).text || "";
  const error = (events.find((e) => e.type === "error") || {}).message;
  const guardrails = events.filter((e) => e.type === "step" && /^Guardrail:/.test(e.label)).map((e) => e.label);
  return { output: { answer, calls, error, guardrails, finished: events.some((e) => e.type === "done"), raw: text } };
};
