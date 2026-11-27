let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx === undefined) {
    try {
      ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

export function fontString(size: number, family: string, bold = false, italic = false): string {
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${family}`;
}

const cache = new Map<string, number>();

export function measure(text: string, font: string): number {
  const key = font + '\u0000' + text;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = context();
  let w: number;
  if (c) {
    c.font = font;
    w = c.measureText(text).width;
  } else {
    const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? '14');
    w = text.length * size * 0.55;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(key, w);
  return w;
}

/** Greedy word wrap. Explicit newlines are kept; very long words are broken. */
export function wrapText(text: string, maxWidth: number, font: string): string[] {
  const out: string[] = [];
  const max = Math.max(maxWidth, 1);
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/).filter((w) => w.length);
    let line = '';
    for (const word of words) {
      const candidate = line + word;
      if (!line || measure(candidate, font) <= max) {
        if (!line && measure(word, font) > max && !/^\s+$/.test(word)) {
          // break a long word into chunks
          let chunk = '';
          for (const ch of word) {
            if (chunk && measure(chunk + ch, font) > max) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else line = candidate;
      } else {
        out.push(line.trimEnd());
        line = /^\s+$/.test(word) ? '' : word;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}
