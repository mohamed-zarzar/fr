import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { studentApi, teacherApi, managerApi } from '@/services/api';
import { useTranslation } from 'react-i18next';

interface SearchResult {
  id: string;
  label: string;
  typeKey: string;
  path: string;
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: students } = useQuery({ queryKey: ['students'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });
  const { data: teachers } = useQuery({ queryKey: ['teachers'], queryFn: () => teacherApi.getAll({ page: 1, limit: 100 }) });
  const { data: managers } = useQuery({ queryKey: ['managers'], queryFn: () => managerApi.getAll({ page: 1, limit: 100 }) });

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];
    (students?.data || []).forEach(s => {
      if (`${s.firstname} ${s.lastname}`.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || Object.values(s.dynamicFields || {}).some(v => typeof v === 'string' && v.toLowerCase().includes(q)))
        out.push({ id: s.id, label: `${s.firstname} ${s.lastname}`, typeKey: 'nav.students', path: `/students/${s.id}` });
    });
    (teachers?.data || []).forEach(tc => {
      if (`${tc.firstname} ${tc.lastname}`.toLowerCase().includes(q) || Object.values(tc.dynamicFields || {}).some(v => typeof v === 'string' && v.toLowerCase().includes(q)))
        out.push({ id: tc.id, label: `${tc.firstname} ${tc.lastname}`, typeKey: 'nav.teachers', path: `/teachers/${tc.id}` });
    });
    (managers?.data || []).forEach(m => {
      if (`${m.firstname} ${m.lastname}`.toLowerCase().includes(q) || Object.values(m.dynamicFields || {}).some(v => typeof v === 'string' && v.toLowerCase().includes(q)))
        out.push({ id: m.id, label: `${m.firstname} ${m.lastname}`, typeKey: 'nav.managers', path: `/managers/${m.id}` });
    });
    return out.slice(0, 10);
  }, [query, students, teachers, managers]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={t('common.searchPlaceholder')}
        className="ps-9"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 start-0 end-0 z-50 bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
          {results.map(r => (
            <button
              key={r.id}
              className="w-full text-start px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
              onClick={() => { navigate(r.path); setOpen(false); setQuery(''); }}
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-xs text-muted-foreground">{t(r.typeKey)}</span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute top-full mt-1 start-0 end-0 z-50 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center">
          {t('common.noResults')}
        </div>
      )}
    </div>
  );
}
