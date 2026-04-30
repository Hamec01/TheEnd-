import { useEffect, useState } from 'react';
import { AdminFieldLabel } from '../adminUi';

interface SkillJsonFieldProps<T> {
  label: string;
  hint?: string;
  value: T;
  rows?: number;
  onChange: (next: T) => void;
  onStatus: (message: string) => void;
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function SkillJsonField<T>({ label, hint, value, rows = 10, onChange, onStatus }: SkillJsonFieldProps<T>) {
  const [text, setText] = useState(() => safeStringify(value));

  useEffect(() => {
    setText(safeStringify(value));
  }, [value]);

  function commit() {
    try {
      onChange(JSON.parse(text) as T);
    } catch (error) {
      onStatus(`${label}: ${(error as Error).message}`);
    }
  }

  return (
    <label>
      <AdminFieldLabel label={label} hint={hint} />
      <textarea rows={rows} value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} spellCheck={false} />
    </label>
  );
}