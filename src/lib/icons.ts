import type { IconData } from '../model/types';

/**
 * Bundled icon sets. Every set here is free and permissively licensed;
 * see THIRD_PARTY_LICENSES.md. Each set is loaded on demand so the app
 * starts fast.
 */
export interface IconSetInfo {
  prefix: string;
  name: string;
  license: string;
  licenseUrl: string;
  author: string;
  load: () => Promise<IconifyJSON>;
}

interface IconifyIcon {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  hidden?: boolean;
}

export interface IconifyJSON {
  prefix: string;
  icons: Record<string, IconifyIcon>;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

const json = (m: { default: unknown }) => m.default as IconifyJSON;

export const ICON_SETS: IconSetInfo[] = [
  {
    prefix: 'lucide', name: 'Lucide', license: 'ISC', author: 'Lucide Contributors',
    licenseUrl: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
    load: () => import('@iconify-json/lucide/icons.json').then(json),
  },
  {
    prefix: 'tabler', name: 'Tabler Icons', license: 'MIT', author: 'Paweł Kuna',
    licenseUrl: 'https://github.com/tabler/tabler-icons/blob/master/LICENSE',
    load: () => import('@iconify-json/tabler/icons.json').then(json),
  },
  {
    prefix: 'material-symbols', name: 'Material Symbols', license: 'Apache 2.0', author: 'Google',
    licenseUrl: 'https://github.com/google/material-design-icons/blob/master/LICENSE',
    load: () => import('@iconify-json/material-symbols/icons.json').then(json),
  },
  {
    prefix: 'ph', name: 'Phosphor', license: 'MIT', author: 'Phosphor Icons',
    licenseUrl: 'https://github.com/phosphor-icons/core/blob/main/LICENSE',
    load: () => import('@iconify-json/ph/icons.json').then(json),
  },
  {
    prefix: 'flag', name: 'Country flags', license: 'MIT', author: 'Panayiotis Lipiridis',
    licenseUrl: 'https://github.com/lipis/flag-icons/blob/main/LICENSE',
    load: () => import('@iconify-json/flag/icons.json').then(json),
  },
  {
    prefix: 'simple-icons', name: 'Simple Icons (brands)', license: 'CC0 1.0', author: 'Simple Icons Collaborators',
    licenseUrl: 'https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md',
    load: () => import('@iconify-json/simple-icons/icons.json').then(json),
  },
  {
    prefix: 'logos', name: 'SVG Logos (incl. AWS, Azure, GCP)', license: 'CC0 1.0', author: 'Gil Barbara',
    licenseUrl: 'https://raw.githubusercontent.com/gilbarbara/logos/master/LICENSE.txt',
    load: () => import('@iconify-json/logos/icons.json').then(json),
  },
];

const loaded = new Map<string, Promise<IconifyJSON>>();

export function loadSet(prefix: string): Promise<IconifyJSON> {
  let p = loaded.get(prefix);
  if (!p) {
    const info = ICON_SETS.find((s) => s.prefix === prefix);
    if (!info) return Promise.reject(new Error(`Unknown icon set ${prefix}`));
    p = info.load();
    loaded.set(prefix, p);
  }
  return p;
}

export function iconNames(set: IconifyJSON): string[] {
  const names = Object.keys(set.icons).filter((n) => !set.icons[n].hidden);
  // flags come in 4:3 and 1:1 versions; show the 4:3 ones
  return set.prefix === 'flag' ? names.filter((n) => !n.endsWith('-1x1')) : names;
}

/** Extra words an icon can be found by (synonyms, country names in English and Portuguese). */
const SYNONYMS: Record<string, string[]> = {
  gear: ['settings', 'cog'],
  engrenagem: ['settings', 'cog'],
  bandeira: ['flag'],
  nuvem: ['cloud'],
  pessoa: ['user', 'person'],
  casa: ['home', 'house'],
  seta: ['arrow'],
  documento: ['file', 'document'],
  'base-de-dados': ['database'],
  servidor: ['server'],
};

let regionNames: ((code: string) => string)[] | null = null;
function countryNames(code: string): string {
  if (!regionNames) {
    regionNames = [];
    for (const lang of ['en', 'pt']) {
      try {
        const dn = new Intl.DisplayNames([lang], { type: 'region' });
        regionNames.push((c) => dn.of(c.toUpperCase()) ?? '');
      } catch {
        /* older browsers: search by code only */
      }
    }
  }
  return regionNames.map((f) => {
    try { return f(code); } catch { return ''; }
  }).join(' ');
}

const keywordCache = new Map<string, string>();
export function iconKeywords(prefix: string, name: string): string {
  const k = `${prefix}:${name}`;
  let v = keywordCache.get(k);
  if (v === undefined) {
    v = name;
    if (prefix === 'flag') {
      const code = name.split('-')[0];
      if (code.length === 2) v += ' ' + countryNames(code).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    }
    keywordCache.set(k, v);
  }
  return v;
}

export function toIconData(set: IconifyJSON, name: string): IconData {
  const ic = set.icons[name];
  const body = ic.body;
  return {
    id: `${set.prefix}:${name}`,
    body,
    vbX: ic.left ?? set.left ?? 0,
    vbY: ic.top ?? set.top ?? 0,
    vbW: ic.width ?? set.width ?? 16,
    vbH: ic.height ?? set.height ?? 16,
    mono: body.includes('currentColor'),
  };
}

/** Rank names: exact > prefix > word-start > substring. Synonyms and keywords count too. */
export function searchIcons(names: string[], query: string, limit = 240, keywords?: (name: string) => string): string[] {
  const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  if (!q) return names.slice(0, limit);
  const terms = [q, ...(SYNONYMS[q] ?? [])];
  const scored: [number, string][] = [];
  for (const n of names) {
    const hay = keywords ? keywords(n) : n;
    let best = Infinity;
    for (const [ti, t] of terms.entries()) {
      const i = hay.indexOf(t);
      if (i < 0) continue;
      const score = (hay === t ? 0 : i === 0 ? 1 : hay[i - 1] === '-' || hay[i - 1] === ' ' ? 2 : 3) + (ti ? 1 : 0);
      best = Math.min(best, score);
    }
    if (best === Infinity) continue;
    scored.push([best * 1000 + n.length, n]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, limit).map((s) => s[1]);
}
