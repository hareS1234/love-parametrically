import { useEffect, useRef, useState } from 'react';
import type { BouquetV1 } from '../data/schema';

type Dedication = BouquetV1['dedication'];

export function DedicationFields({ value, onCommit, compact = false }: { value: Dedication; onCommit(value: Dedication): void; compact?: boolean }) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setDraft(value), [value]);
  const update = <K extends keyof Dedication>(key: K, next: Dedication[K]) => {
    const changed = { ...draft, [key]: next };
    setDraft(changed);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(changed), 500);
  };
  const commit = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; onCommit(draft); };
  return (
    <div className={`dedication-fields ${compact ? 'compact-fields' : ''}`}>
      <div className="field-row">
        <label>To<input value={draft.to} maxLength={48} onChange={(event) => update('to', event.target.value)} onBlur={commit} placeholder="Name" /></label>
        <label>From<input value={draft.from} maxLength={48} onChange={(event) => update('from', event.target.value)} onBlur={commit} placeholder="Your name" /></label>
      </div>
      <label>A small note<textarea value={draft.note} maxLength={160} onChange={(event) => update('note', event.target.value)} onBlur={commit} rows={compact ? 3 : 4} placeholder="Write something here." /><span className="field-count">{[...draft.note].length}/160</span></label>
      <label className="date-field"><input type="checkbox" checked={draft.displayDate !== null} onChange={(event) => update('displayDate', event.target.checked ? new Date().toISOString().slice(0, 10) : null)} /> Display date</label>
    </div>
  );
}
