import type Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, SEVERITIES } from "./types";

const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});

export const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: "route_ticket",
    description: "Classify the ticket. Always call this first, before any other tool.",
    input_schema: obj(
      {
        category: { type: "string", enum: [...CATEGORIES] },
        urgency: { type: "integer", description: "1 (lowest) to 4 (customer cannot work or data at risk)" },
        confidence: { type: "number", description: "0 to 1" },
      },
      ["category", "urgency", "confidence"],
    ),
  },
  {
    name: "search_kb",
    description:
      "Semantic (vector) search of the help-centre knowledge base. Returns the 3 closest articles with id, title, similarity (0 to 1) and text. Closest is not the same as relevant: state a rule only if the returned text contains it. Use it for every policy, price or how-to fact.",
    input_schema: obj({ query: { type: "string", description: "The question or topic in plain words" } }, ["query"]),
  },
  {
    name: "lookup_customer",
    description: "Look up a customer's profile, orders (with age in days) and refund history by customer_id or email.",
    input_schema: obj({ customer_id: { type: "string" }, email: { type: "string" } }, []),
  },
  {
    name: "draft_reply",
    description:
      "Propose a customer reply (under 120 words, polite, no personal data). Nothing is sent until a human approves.",
    input_schema: obj(
      {
        ticket_id: { type: "string", description: "The ticket id from the ticket header" },
        body: { type: "string" },
        kb_article_ids: { type: "array", items: { type: "string" }, description: "KB article ids the reply relies on" },
      },
      ["ticket_id", "body", "kb_article_ids"],
    ),
  },
  {
    name: "issue_refund",
    description: "Propose a refund for one order. Nothing is refunded until a human approves.",
    input_schema: obj(
      {
        order_id: { type: "string" },
        amount: { type: "number", description: "USD, at most 2 decimals" },
        reason: { type: "string" },
      },
      ["order_id", "amount", "reason"],
    ),
  },
  {
    name: "create_bug_ticket",
    description: "Propose a bug ticket for engineering. Nothing is filed until a human approves.",
    input_schema: obj(
      {
        title: { type: "string" },
        steps: { type: "array", items: { type: "string" }, description: "Steps to reproduce" },
        severity: { type: "string", enum: [...SEVERITIES] },
      },
      ["title", "steps", "severity"],
    ),
  },
  {
    name: "escalate_to_human",
    description: "Propose handing the ticket to a human specialist. Nothing happens until a human approves.",
    input_schema: obj({ reason: { type: "string" }, summary: { type: "string" } }, ["reason", "summary"]),
  },
];
