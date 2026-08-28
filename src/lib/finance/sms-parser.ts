import { parse as parseDate, isValid as isValidDate } from "date-fns";
import type { SmsRuleDoc } from "@/shared/finance-schemas";

// Token types a rule's `pattern` string can use, written as `{token}`.
type TemplateToken = "amount" | "balance" | "account" | "date" | "time" | "merchant" | "desc" | "*";

const TOKEN_SPLIT = /\{([a-zA-Z*]+)\}/g;

const DATE_FORMAT_CANDIDATES = [
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd",
  "dd/MM/yy hh:mm a",
  "dd/MM/yyyy hh:mm a",
  "dd-MM-yy HH:mm:ss",
  "dd-MM-yyyy HH:mm:ss",
  "dd-MM-yy",
  "dd-MM-yyyy",
  "dd/MM/yy",
  "dd/MM/yyyy",
  "MM/dd/yy",
  "MM/dd/yyyy",
];

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Collapses whitespace runs to `\s+` so minor spacing differences in the real
// message (e.g. a stray double space) don't break the match. Boundary
// whitespace (e.g. the space right before/after a token) is preserved as a
// `\s+` requirement rather than dropped, so tokens stay separated from
// adjacent literal words.
function literalToRegexSource(literal: string) {
  const runs = literal.match(/\s+|\S+/g);
  if (!runs) return "";
  return runs.map((run) => (/^\s+$/.test(run) ? "\\s+" : escapeRegExp(run))).join("");
}

function tokenRegexSource(token: string, isLast: boolean): { source: string; capture: boolean } {
  switch (token) {
    case "amount":
    case "balance":
      return { source: "([\\d,]+\\.?\\d*)", capture: true };
    case "account":
      return { source: "([A-Za-z0-9*Xx-]+)", capture: true };
    case "*":
      return { source: ".*?", capture: false };
    case "date":
    case "time":
    case "merchant":
    case "desc":
      // Free-text captures are non-greedy so they stop at the next literal
      // anchor — except when nothing follows, where non-greedy would only
      // ever match a single character.
      return { source: isLast ? "(.+)" : "(.+?)", capture: true };
    default:
      return { source: ".*?", capture: false };
  }
}

type CompiledTemplate = {
  regex: RegExp;
  // One entry per capturing group, in order.
  groupTokens: TemplateToken[];
};

export function compileSmsPattern(pattern: string): CompiledTemplate {
  const matches = [...pattern.matchAll(TOKEN_SPLIT)];
  let cursor = 0;
  let source = "";
  const groupTokens: TemplateToken[] = [];

  matches.forEach((match, index) => {
    const literal = pattern.slice(cursor, match.index);
    source += literalToRegexSource(literal);
    cursor = (match.index ?? 0) + match[0].length;

    const token = match[1];
    const isLast = index === matches.length - 1;
    const { source: tokenSource, capture } = tokenRegexSource(token, isLast);
    source += tokenSource;
    if (capture) groupTokens.push(token as TemplateToken);
  });

  const trailingLiteral = pattern.slice(cursor);
  source += literalToRegexSource(trailingLiteral);

  return { regex: new RegExp(source, "i"), groupTokens };
}

export type ParsedSmsFields = {
  amount?: number;
  balance?: number;
  account?: string;
  merchant?: string;
  rawDate?: string;
  rawTime?: string;
};

function parseAmountString(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/,/g, "").trim();
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function matchSmsPattern(pattern: string, body: string): ParsedSmsFields | null {
  const { regex, groupTokens } = compileSmsPattern(pattern);
  const normalizedBody = body.replace(/\s+/g, " ").trim();
  const match = normalizedBody.match(regex);
  if (!match) return null;

  const fields: ParsedSmsFields = {};
  groupTokens.forEach((token, i) => {
    const value = match[i + 1]?.trim();
    if (!value) return;
    switch (token) {
      case "amount":
        fields.amount = fields.amount ?? parseAmountString(value);
        break;
      case "balance":
        fields.balance = fields.balance ?? parseAmountString(value);
        break;
      case "account":
        fields.account = fields.account ?? value;
        break;
      case "merchant":
      case "desc":
        fields.merchant = fields.merchant ?? value;
        break;
      case "date":
        fields.rawDate = fields.rawDate ?? value;
        break;
      case "time":
        fields.rawTime = fields.rawTime ?? value;
        break;
    }
  });

  return fields;
}

// Tries to parse a captured date (optionally combined with a captured time)
// against a handful of common bank-SMS date formats. Returns null if none
// match, so the caller can fall back to the SMS's own received time.
export function resolveOccurredAt(fields: ParsedSmsFields, receivedAt: Date): Date | null {
  if (!fields.rawDate) return null;
  const combined = fields.rawTime ? `${fields.rawDate} ${fields.rawTime}` : fields.rawDate;

  for (const format of DATE_FORMAT_CANDIDATES) {
    const parsed = parseDate(combined, format, receivedAt);
    if (isValidDate(parsed)) return parsed;
  }
  return null;
}

export function applyNoteTemplate(noteTemplate: string | undefined, fields: ParsedSmsFields, fallback: string) {
  if (!noteTemplate) return fallback.slice(0, 280);
  const filled = noteTemplate
    .replace(/\{amount\}/gi, fields.amount != null ? String(fields.amount) : "")
    .replace(/\{balance\}/gi, fields.balance != null ? String(fields.balance) : "")
    .replace(/\{account\}/gi, fields.account ?? "")
    .replace(/\{merchant\}/gi, fields.merchant ?? "")
    .replace(/\{desc\}/gi, fields.merchant ?? "")
    .replace(/\{date\}/gi, fields.rawDate ?? "")
    .replace(/\{time\}/gi, fields.rawTime ?? "")
    .trim();
  return (filled || fallback).slice(0, 280);
}

export type SmsMatchResult = {
  rule: SmsRuleDoc;
  // `amount` is guaranteed present — matchMessageAgainstRules only returns a
  // result once a rule's pattern has captured a usable amount.
  fields: ParsedSmsFields & { amount: number };
};

// Tries every enabled rule whose senderMatch is contained in `sender`
// (case-insensitive), in order, returning the first one whose pattern
// matches the message body.
export function matchMessageAgainstRules(
  rules: SmsRuleDoc[],
  sender: string | undefined,
  body: string,
): SmsMatchResult | null {
  const senderLower = (sender ?? "").toLowerCase();
  const candidates = rules.filter(
    (r) => r.enabled && (!sender || senderLower.includes(r.senderMatch.toLowerCase())),
  );

  for (const rule of candidates) {
    const fields = matchSmsPattern(rule.pattern, body);
    if (fields && fields.amount != null) {
      return { rule, fields: fields as ParsedSmsFields & { amount: number } };
    }
  }
  return null;
}
