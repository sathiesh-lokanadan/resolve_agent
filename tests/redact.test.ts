import { describe, expect, it } from "vitest";
import { findPii, redact, redactDeep } from "@/lib/redact";

describe("redact", () => {
  it.each([
    ["maya.okafor@brightside-bakery.example", "[redacted email]"],
    ["maya [at] example [dot] com", "[redacted email]"],
    ["maya(at)example(dot)com", "[redacted email]"],
    ["4242 4242 4242 4242", "[redacted card]"],
    ["4242-4242-4242-4242", "[redacted card]"],
    ["4242424242424242", "[redacted card]"],
    ["3782 822463 10005", "[redacted card]"],
    ["+1 415 555 0134", "[redacted phone]"],
    ["(415) 555-0134", "[redacted phone]"],
    ["415.555.0134", "[redacted phone]"],
    ["123-45-6789", "[redacted ssn]"],
    ["DE89 3704 0044 0532 0130 00", "[redacted iban]"],
    ["sk-ant-api03-abcdefghijklmnop1234", "[redacted secret]"],
    ["AIzaSyA-1234567890abcdefghijklmn", "[redacted secret]"],
    ["Bearer abcdefghijklmnopqrstuvwxyz123", "[redacted secret]"],
  ])("redacts %s", (input, token) => {
    expect(redact(`before ${input} after`)).toBe(`before ${token} after`);
  });

  it.each(["ord_1001", "T-1002", "INV-2231", "kb_008", "2026-11-10", "$49.00", "49 USD", "30 days", "look at this", "version 3.2.1", "apr_12"])(
    "leaves %s alone",
    (text) => expect(redact(text)).toBe(text),
  );

  it("redacts every occurrence and nested values", () => {
    const out = redactDeep({ a: ["x@y.example", { b: "call 415 555 0134 or a@b.example" }], n: 5 });
    expect(JSON.stringify(out)).not.toMatch(/@|555/);
    expect(out.n).toBe(5);
  });

  it("findPii names what is left, once per kind", () => {
    expect(findPii("a@b.example c@d.example 4242 4242 4242 4242")).toEqual(["email", "card number"]);
    expect(findPii("nothing here")).toEqual([]);
    expect(findPii("[redacted email]")).toEqual([]);
  });
});
