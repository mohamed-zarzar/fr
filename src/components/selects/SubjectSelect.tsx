import { useCallback, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { subjectApi } from '@/services/api';
import type { Subject } from '@/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useInfiniteScrollSentinel } from '@/hooks/useInfiniteScrollSentinel';

const PAGE_SIZE = 10;

export type SubjectSelectAllOption = { value: string; label: string };

export interface SubjectSelectProps {
  /** When false, `value` / `onChange` use a single id (e.g. filters). Default: true (multi). */
  multiple?: boolean;
  value: string[] | string;
  onChange: (v: string[] | string) => void;
  placeholder?: string;
  requiredResult?: string[];
  className?: string;
  disabled?: boolean;
  allOption?: SubjectSelectAllOption;
  /** When user toggles a subject (multi mode), receive id + display label for parent UIs. */
  onSubjectLabelResolved?: (id: string, label: string) => void;
}

function subjectLabel(s: Pick<Subject, 'name' | 'code'>): string {
  return s.code ? `${s.name} (${s.code})` : s.name;
}

export function SubjectSelect({
  multiple = true,
  value,
  onChange,
  placeholder,
  requiredResult = [],
  className,
  disabled,
  allOption,
  onSubjectLabelResolved,
}: SubjectSelectProps) {
  const { t } = useTranslation();
  const isMulti = multiple !== false;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const reqKey = useMemo(() => [...requiredResult].filter(Boolean).sort().join(','), [requiredResult]);

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['subjects', 'select', debouncedSearch, reqKey],
    queryFn: ({ pageParam }) =>
      subjectApi.select({
        page: pageParam,
        limit: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        requiredResult: requiredResult.length ? requiredResult : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.success && last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: open || requiredResult.length > 0,
  });

  const items = useMemo(() => {
    const rows = data?.pages.flatMap((p) => p.data) ?? [];
    const seen = new Set<string>();
    const out: Subject[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out;
  }, [data]);

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  useInfiniteScrollSentinel(listRef, sentinelRef, open, !!hasNextPage, isFetchingNextPage, loadMore);

  const selectedIds = isMulti ? (Array.isArray(value) ? value : []) : [];
  const singleValue = !isMulti ? (typeof value === 'string' ? value : '') : '';

  const displayLabelSingle = useMemo(() => {
    if (!allOption || singleValue !== allOption.value) {
      const found = items.find((s) => s.id === singleValue);
      return found ? subjectLabel(found) : '';
    }
    return allOption.label;
  }, [allOption, singleValue, items]);

  const subjectById = useMemo(() => {
    const m = new Map<string, Subject>();
    for (const s of items) m.set(s.id, s);
    return m;
  }, [items]);

  if (!isMulti) {
    return (
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('justify-between font-normal', className)}
          >
            <span className="truncate">
              {displayLabelSingle ||
                placeholder ||
                t('common.allSubjects', { defaultValue: 'All subjects' })}
            </span>
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t('common.search', { defaultValue: 'Search…' })}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList ref={listRef} className="max-h-64">
              {allOption ? (
                <CommandGroup>
                  <CommandItem
                    value={`__all__${allOption.value}`}
                    onSelect={() => {
                      onChange(allOption.value);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'me-2 h-4 w-4',
                        singleValue === allOption.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {allOption.label}
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {isLoading && items.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
              ) : null}
              {!isLoading && items.length === 0 && !allOption ? (
                <CommandEmpty>{t('common.noResults', { defaultValue: 'No results' })}</CommandEmpty>
              ) : null}
              {items.length > 0 ? (
                <CommandGroup>
                  {items.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.id}
                      onSelect={() => {
                        onChange(s.id);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Check
                        className={cn('me-2 h-4 w-4', singleValue === s.id ? 'opacity-100' : 'opacity-0')}
                      />
                      {subjectLabel(s)}
                    </CommandItem>
                  ))}
                  <div ref={sentinelRef} className="h-2 w-full shrink-0" aria-hidden />
                </CommandGroup>
              ) : null}
              {isFetchingNextPage ? (
                <div className="py-2 text-center text-xs text-muted-foreground">{t('common.loading')}</div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-auto min-h-10 w-full justify-between py-2 font-normal', className)}
        >
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap gap-1 text-start">
              {selectedIds.slice(0, 3).map((id) => {
                const s = subjectById.get(id);
                const label = s ? subjectLabel(s) : id;
                return (
                  <Badge variant="secondary" key={id}>
                    {label}
                  </Badge>
                );
              })}
              {selectedIds.length > 3 && <Badge variant="secondary">+{selectedIds.length - 3}</Badge>}
            </div>
          ) : (
            <span className="text-muted-foreground">
              {placeholder || t('teachers.selectSubjects', { defaultValue: 'Select subjects' })}
            </span>
          )}
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: '320px' }} align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('teachers.searchSubjects', { defaultValue: 'Search subjects…' })}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} className="max-h-64">
            {isLoading && items.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : null}
            {!isLoading && items.length === 0 ? (
              <CommandEmpty>{t('teachers.noSubjectsFound', { defaultValue: 'No subjects found' })}</CommandEmpty>
            ) : null}
            {items.length > 0 ? (
              <CommandGroup>
                {items.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      const current = selectedIds;
                      const adding = !current.includes(s.id);
                      const updated = adding
                        ? [...current, s.id]
                        : current.filter((id) => id !== s.id);
                      if (adding) onSubjectLabelResolved?.(s.id, subjectLabel(s));
                      onChange(updated);
                    }}
                  >
                    <Check
                      className={cn(
                        'me-2 h-4 w-4',
                        selectedIds.includes(s.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {subjectLabel(s)}
                  </CommandItem>
                ))}
                <div ref={sentinelRef} className="h-2 w-full shrink-0" aria-hidden />
              </CommandGroup>
            ) : null}
            {isFetchingNextPage ? (
              <div className="py-2 text-center text-xs text-muted-foreground">{t('common.loading')}</div>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
