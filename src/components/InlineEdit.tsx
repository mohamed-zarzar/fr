import { useState, useRef, useEffect } from 'react';

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
  as?: 'input' | 'textarea';
}

export function InlineEdit({ value, onSave, className = '', placeholder = 'Click to edit', as = 'input' }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
    else setDraft(value);
  };

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors ${className}`}
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title="Click to edit"
      >
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
    );
  }

  const commonProps = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: save,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !(as === 'textarea' && !e.shiftKey)) save();
      if (e.key === 'Escape') { setDraft(value); setEditing(false); }
    },
    className: 'rounded border border-input bg-background px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  if (as === 'textarea') {
    return <textarea ref={ref as any} {...commonProps} rows={2} />;
  }

  return <input ref={ref as any} {...commonProps} />;
}
