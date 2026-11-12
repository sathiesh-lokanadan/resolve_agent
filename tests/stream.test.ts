import { describe, expect, it } from "vitest";
import { consumeStream } from "@/lib/stream";
import type { StreamEvent } from "@/lib/types";

const body = (chunks: string[], hang = false) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      chunks.forEach((x) => c.enqueue(enc.encode(x)));
      if (!hang) c.close();
    },
  });
const line = (e: StreamEvent) => JSON.stringify(e) + "\n";

describe("consumeStream (client side)", () => {
  it("parses events split across chunks", async () => {
    const got: StreamEvent[] = [];
    const text = line({ type: "step", label: "a" }) + line({ type: "answer", text: "hi" }) + line({ type: "done" });
    await consumeStream(body([text.slice(0, 10), text.slice(10, 40), text.slice(40)]), (e) => got.push(e));
    expect(got.map((e) => e.type)).toEqual(["step", "answer", "done"]);
  });
  it("fails when the stream ends without done (dropped connection)", async () => {
    await expect(consumeStream(body([line({ type: "step", label: "a" })]), () => {})).rejects.toThrow(/dropped/);
  });
  it("fails when a stream stalls", async () => {
    await expect(consumeStream(body([line({ type: "step", label: "a" })], true), () => {}, undefined, 30)).rejects.toThrow(/stopped responding/);
  });
  it("reports corrupt lines instead of skipping them silently", async () => {
    await expect(consumeStream(body(["{not json\n", line({ type: "done" })]), () => {})).rejects.toThrow(/corrupt/);
  });
});
