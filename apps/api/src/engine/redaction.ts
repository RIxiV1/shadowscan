import type { SensitiveClass } from '@shadowscan/shared';

export interface ContentFinding {
  class: SensitiveClass;
  count: number;
}

export interface InspectionResult {
  // Input with every identifier match replaced by a `[REDACTED:class]` marker.
  redacted: string;
  findings: ContentFinding[];
  totalHits: number;
}

interface IdentifierRule {
  class: SensitiveClass;
  pattern: RegExp;
  validate?: (match: string) => boolean;
}

function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

// Aadhaar numbers never start with 0 or 1, and repdigits are placeholders.
function plausibleAadhaar(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 12) return false;
  if (digits.startsWith('0') || digits.startsWith('1')) return false;
  return !/^(\d)\1{11}$/.test(digits);
}

const IDENTIFIER_RULES: readonly IdentifierRule[] = [
  {
    class: 'private-key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    class: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    class: 'api-key',
    // Covers the prefixed key formats that are worth alerting on: OpenAI/Stripe
    // `sk-`, GitHub `ghp_`/`gho_`, AWS `AKIA`, Google `AIza`, Slack `xox*`.
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[0-9A-Za-z-]{10,})\b/g,
  },
  {
    class: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    class: 'credit-card',
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    validate: luhnValid,
  },
  {
    class: 'aadhaar',
    pattern: /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
    validate: plausibleAadhaar,
  },
  {
    class: 'phone',
    pattern: /\b(?:\+91[ -]?|0)?[6-9]\d{9}\b/g,
  },
  {
    class: 'ip-address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
  },
];

// Scans text for structured identifiers and returns a redacted copy plus counts.
export function inspectContent(input: string): InspectionResult {
  if (!input) return { redacted: '', findings: [], totalHits: 0 };

  // Bound the work: prompt fields in a hostile upload can be megabytes.
  let working = input.length > 8192 ? input.slice(0, 8192) : input;
  const findings: ContentFinding[] = [];

  for (const rule of IDENTIFIER_RULES) {
    let count = 0;
    // `pattern` carries /g, so a fresh RegExp avoids shared `lastIndex` state
    // between calls - the classic source of intermittently missed matches.
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    working = working.replace(pattern, (match) => {
      if (rule.validate && !rule.validate(match)) return match;
      count += 1;
      return `[REDACTED:${rule.class}]`;
    });
    if (count > 0) findings.push({ class: rule.class, count });
  }

  const totalHits = findings.reduce((sum, finding) => sum + finding.count, 0);
  return { redacted: working, findings, totalHits };
}

// Counts distinct confidential keywords present in text.
export function findConfidentialKeywords(text: string, keywords: readonly string[]): string[] {
  if (!text || keywords.length === 0) return [];
  const haystack = text.toLowerCase();
  const matched: string[] = [];

  for (const keyword of keywords) {
    const needle = keyword.trim().toLowerCase();
    if (needle.length < 3) continue;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      const before = index === 0 ? ' ' : haystack[index - 1] ?? ' ';
      const afterIndex = index + needle.length;
      const after = afterIndex >= haystack.length ? ' ' : haystack[afterIndex] ?? ' ';
      if (!isWordChar(before) && !isWordChar(after)) {
        matched.push(needle);
        break;
      }
      index = haystack.indexOf(needle, index + needle.length);
    }
  }

  return matched;
}

function isWordChar(char: string): boolean {
  return /[a-z0-9]/.test(char);
}
