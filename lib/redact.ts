const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const CARD =
  /(?<![\d-])(?:\d{4}[ -]?){3}\d{1,7}(?![\d-])|(?<!\d)\d{13,19}(?!\d)|(?<!\d)3[47]\d{2}[ -]?\d{6}[ -]?\d{5}(?!\d)/g;
const PHONE =
  /(?<![\w-])(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}(?![\w-])|(?<!\w)\+\d{1,3}(?:[ .-]?\d{2,4}){2,4}(?![\w-])/g;

const RULES: [string, RegExp, string][] = [
  ["email", EMAIL, "[redacted email]"],
  ["card number", CARD, "[redacted card]"],
  ["phone number", PHONE, "[redacted phone]"],
];

export function redact(text: string): string {
  return RULES.reduce((out, [, re, token]) => out.replace(re, token), text);
}

/** Names of the personal-data kinds still present in the text. */
export function findPii(text: string): string[] {
  return RULES.filter(([, re]) => new RegExp(re.source, "").test(text)).map(([kind]) => kind);
}

export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value)) return value.map(redactDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redactDeep(v)]),
    ) as T;
  }
  return value;
}
