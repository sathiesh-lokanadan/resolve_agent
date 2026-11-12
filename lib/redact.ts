const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const CARD =
  /(?<![\d-])(?:\d{4}[ -]?){3}\d{1,7}(?![\d-])|(?<!\d)\d{13,19}(?!\d)|(?<!\d)3[47]\d{2}[ -]?\d{6}[ -]?\d{5}(?!\d)/g;
const PHONE =
  /(?<![\w-])(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}(?![\w-])|(?<!\w)\+\d{1,3}(?:[ .-]?\d{2,4}){2,4}(?![\w-])/g;

// Emails written to dodge filters: "maya [at] example [dot] com".
const EMAIL_OBFUSCATED =
  /[A-Za-z0-9._%+-]+\s*[[(]\s*at\s*[\])]\s*[A-Za-z0-9-]+(?:\s*[[(]\s*dot\s*[\])]\s*[A-Za-z0-9-]+)+/gi;
const SSN = /(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])/g;
const IBAN = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g;
// API keys and bearer tokens pasted into a ticket.
const SECRET =
  /(?<![A-Za-z0-9_-])(?:(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/g;

const RULES: [string, RegExp, string][] = [
  ["secret or API key", SECRET, "[redacted secret]"],
  ["email", EMAIL, "[redacted email]"],
  ["email", EMAIL_OBFUSCATED, "[redacted email]"],
  ["IBAN", IBAN, "[redacted iban]"],
  ["SSN", SSN, "[redacted ssn]"],
  ["card number", CARD, "[redacted card]"],
  ["phone number", PHONE, "[redacted phone]"],
];

export function redact(text: string): string {
  return RULES.reduce((out, [, re, token]) => out.replace(re, token), text);
}

/** Names of the personal-data kinds still present in the text. */
export function findPii(text: string): string[] {
  return [...new Set(RULES.filter(([, re]) => new RegExp(re.source, re.flags.replace("g", "")).test(text)).map(([kind]) => kind))];
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
