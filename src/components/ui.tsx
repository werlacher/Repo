import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PALETTE } from '../model/defaults';

const ICONS: Record<string, ReactNode> = {
  select: <path d="M5 3l14 8-6 1.5L10 19z" />,
  hand: <path d="M8 12V5.5a1.5 1.5 0 013 0V11m0-6.5a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0v7c0 4-2.5 7-6.5 7S5 17.5 4 15l-1.2-2.6a1.4 1.4 0 012.4-1.4L8 14" />,
  connector: <><circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /><path d="M6.5 17.5L11 13V11h2V9l4.5-2.5" /></>,
  text: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>,
  front: <><rect x="8" y="8" width="12" height="12" rx="1" fill="currentColor" /><path d="M4 16V4h12" /></>,
  back: <><rect x="4" y="4" width="12" height="12" rx="1" fill="currentColor" /><path d="M20 8v12H8" /></>,
  file: <path d="M14 3H6v18h12V7zM14 3v4h4" />,
  open: <path d="M3 7V5h7l2 2h9v12H3zM3 9h18" />,
  save: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></>,
  download: <path d="M12 4v11m-5-5l5 5 5-5M5 20h14" />,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></>,
  grid: <path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16" />,
  magnet: <path d="M6 4v8a6 6 0 0012 0V4h-4v8a2 2 0 01-4 0V4zM6 8h4M14 8h4" />,
  alignLeft: <path d="M4 3v18M8 7h10v4H8zM8 14h6v4H8z" />,
  alignHCenter: <path d="M12 3v18M6 7h12v4H6zM8 14h8v4H8z" />,
  alignRight: <path d="M20 3v18M6 7h10v4H6zM10 14h6v4h-6z" />,
  alignTop: <path d="M3 4h18M7 8v10h4V8zM14 8v6h4V8z" />,
  alignVCenter: <path d="M3 12h18M7 6v12h4V6zM14 8v8h4V8z" />,
  alignBottom: <path d="M3 20h18M7 6v10h4V6zM14 10v6h4v-6z" />,
  distH: <path d="M4 3v18M20 3v18M9 8h6v8H9z" />,
  distV: <path d="M3 4h18M3 20h18M8 9h8v6H8z" />,
  bold: <path d="M7 4h6a4 4 0 010 8H7zM7 12h7a4 4 0 010 8H7z" />,
  italic: <path d="M10 4h8M6 20h8M14 4l-4 16" />,
  underline: <path d="M7 4v7a5 5 0 0010 0V4M5 20h14" />,
  tLeft: <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />,
  tCenter: <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
  tRight: <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />,
  vTop: <path d="M4 4h16M8 8h8M8 12h8" />,
  vMiddle: <path d="M8 9h8M8 13h8M4 4h16M4 20h16" opacity="1" />,
  vBottom: <path d="M4 20h16M8 12h8M8 16h8" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  page: <path d="M6 3h9l4 4v14H6z" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 4M12 17h.01" /></>,
};

export function Icon({ name, size = 18 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function IconButton({ icon, title, onClick, active, disabled, children }: {
  icon?: string; title: string; onClick?: () => void; active?: boolean; disabled?: boolean; children?: ReactNode;
}) {
  return (
    <button type="button" className={`icon-btn${active ? ' active' : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function ColorField({ label, value, onChange, allowNone }: {
  label: string; value: string; onChange: (v: string, live?: boolean) => void; allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  const none = value === 'none' || value === 'transparent';
  return (
    <div className="field color-field" ref={ref}>
      <span className="field-label">{label}</span>
      <button type="button" className="swatch-btn" onClick={() => setOpen((o) => !o)} title={label}>
        <span className={`swatch${none ? ' none' : ''}`} style={{ background: none ? undefined : value }} />
        <span className="swatch-text">{none ? 'None' : value}</span>
      </button>
      {open && (
        <div className="popover color-popover">
          <div className="swatch-grid">
            {allowNone && (
              <button type="button" className="swatch none" title="None" onClick={() => { onChange('none'); setOpen(false); }} />
            )}
            {PALETTE.map((c) => (
              <button type="button" key={c} className={`swatch${c === value ? ' sel' : ''}`} style={{ background: c }} title={c}
                onClick={() => { onChange(c); setOpen(false); }} />
            ))}
          </div>
          <label className="custom-color">
            Custom
            <input type="color" value={none || !/^#[0-9a-f]{6}$/i.test(value) ? '#ffffff' : value} onChange={(e) => onChange(e.target.value, true)} />
          </label>
        </div>
      )}
    </div>
  );
}

export function NumberField({ label, value, onCommit, min, max, step = 1, suffix }: {
  label: string; value: number; onCommit: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  const [text, setText] = useState(String(round(value)));
  useEffect(() => setText(String(round(value))), [value]);
  const commit = () => {
    let v = parseFloat(text);
    if (!Number.isFinite(v)) return setText(String(round(value)));
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (v !== value) onCommit(v);
    else setText(String(round(value)));
  };
  return (
    <label className="field number-field">
      <span className="field-label">{label}</span>
      <span className="number-wrap">
        <input
          type="number"
          value={text}
          step={step}
          min={min}
          max={max}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { setText(String(round(value))); (e.target as HTMLInputElement).blur(); }
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </span>
    </label>
  );
}

const round = (v: number) => Math.round(v * 100) / 100;

export function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T | null; options: { value: T; icon?: string; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button type="button" key={o.value} className={value === o.value ? 'active' : ''} title={o.label} aria-label={o.label} onClick={() => onChange(o.value)}>
          {o.icon ? <Icon name={o.icon} size={16} /> : o.label}
        </button>
      ))}
    </div>
  );
}
