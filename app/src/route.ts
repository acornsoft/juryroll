export type AppRoute =
  | { name: 'home'; preset: string | null }
  | { name: 'states' }
  | { name: 'state'; code: string }
  | { name: 'law'; topic: string | null }
  | { name: 'faq' }
  | { name: 'records-audit'; code: string | null }
  | { name: 'jury-handoff'; code: string | null }
  | { name: 'disclaimer' };

export function parseRoute(hash: string): AppRoute {
  const path = (hash.replace(/^#/, '') || '/').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0 || parts[0] === 'run') {
    const preset = parts[1] && /^[a-z]{2}$/i.test(parts[1]) ? parts[1].toUpperCase() : null;
    return { name: 'home', preset };
  }
  if (parts[0] === 'states') return { name: 'states' };
  if (parts[0] === 'state' && parts[1] && /^[a-z]{2}$/i.test(parts[1])) {
    return { name: 'state', code: parts[1].toUpperCase() };
  }
  if (parts[0] === 'law') return { name: 'law', topic: parts[1] ?? null };
  if (parts[0] === 'faq') return { name: 'faq' };
  if (parts[0] === 'disclaimer') return { name: 'disclaimer' };
  if (parts[0] === 'records-audit') {
    const picked = parts[1] && /^[a-z]{2}$/i.test(parts[1]) ? parts[1].toUpperCase() : null;
    return { name: 'records-audit', code: picked };
  }
  if (parts[0] === 'jury-handoff-letter') {
    const picked = parts[1] && /^[a-z]{2}$/i.test(parts[1]) ? parts[1].toUpperCase() : null;
    return { name: 'jury-handoff', code: picked };
  }
  return { name: 'home', preset: null };
}
