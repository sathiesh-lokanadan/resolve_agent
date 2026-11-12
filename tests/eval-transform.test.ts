import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type Output = {
  answer: string; calls: { name: string; status: string; args: unknown }[]; error?: string; guardrails: string[]; finished: boolean;
};
// promptfoo reads `output` (and top-level `error`) from the return value; any other top-level key is ignored.
const raw = createRequire(import.meta.url)("../evals/transform.js") as (j: unknown, t: string) => { output: Output };
const transform = (j: unknown, t: string) => {
  const r = raw(j, t);
  expect(Object.keys(r)).toEqual(["output"]);
  return r.output;
};
const nd = (...e: object[]) => e.map((x) => JSON.stringify(x)).join("\n") + "\n";

describe("promptfoo transform (live-eval harness)", () => {
  it("turns the stream into calls, answer, guardrail notices and a finished flag", () => {
    const out = transform(null, nd(
      { type: "tool_start", id: "1", name: "route_ticket", args: { category: "bug" } },
      { type: "tool_end", id: "1", name: "route_ticket", ms: 3, result: { status: "ok" } },
      { type: "step", label: "Guardrail: Removed citation(s) kb_099" },
      { type: "answer", text: "hi" },
      { type: "done" },
    ));
    expect(out.calls).toEqual([{ name: "route_ticket", status: "ok", args: { category: "bug" }, result: { status: "ok" } }]);
    expect(out).toMatchObject({ answer: "hi", finished: true, guardrails: ["Guardrail: Removed citation(s) kb_099"] });
  });
  it("marks a stream without done as unfinished and surfaces errors", () => {
    const out = transform(null, nd({ type: "error", message: "boom" }) + "garbage line\n");
    expect(out).toMatchObject({ finished: false, error: "boom", answer: "" });
  });
});
