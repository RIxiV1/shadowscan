// URL normalisation.

export interface NormalisedUrl {
  // Lowercase hostname, no port, no trailing dot, no `www.` prefix.
  host: string;
  path: string;
  query: string;
}

const HOST_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export function normaliseUrl(input: string): NormalisedUrl | null {
  const trimmed = input?.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  // Strip surrounding quotes some CSV exporters leave behind.
  const unquoted = trimmed.replace(/^["']|["']$/g, '');
  if (!unquoted) return null;

  // `WHATWG URL` needs a scheme; assume https for bare hosts and host/path pairs.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(unquoted) ? unquoted : `https://${unquoted}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  // Only web traffic is meaningful here. `chrome://`, `file://` and `about:` rows
  // are noise in a browser history export and would otherwise inflate row counts.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  let host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);
  if (!host || !HOST_PATTERN.test(host)) return null;

  const path = parsed.pathname && parsed.pathname !== '' ? parsed.pathname : '/';

  return {
    host,
    path: path.slice(0, 512),
    query: parsed.search.startsWith('?') ? parsed.search.slice(1) : '',
  };
}

// Yields a hostname and each of its parent domains, most specific first.
export function* domainSuffixes(host: string): Generator<string> {
  const labels = host.split('.');
  for (let i = 0; i < labels.length; i += 1) {
    yield labels.slice(i).join('.');
  }
}

// Decodes a query string into readable text for content scanning.
export function decodeQueryText(query: string): string {
  if (!query) return '';
  const withSpaces = query.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(withSpaces);
  } catch {
    return withSpaces;
  }
}
