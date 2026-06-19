import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parentApi } from '@/services/api';
import type { Parent } from '@/types';
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

export interface ParentSelectProps {
  value: string[];
  onChange: (parentIds: string[]) => void;
  requiredResult?: string[];
  levelId?: string;
  classId?: string;
  subjectId?: string;
  /** Names for known parents (e.g. from student detail) before list loads. */
  seedParents?: { id: string; firstname: string; lastname: string }[];
  /** Fired when display names are known (seed + loaded pages). */
  onParentsMetadataChange?: (byId: Record<string, { firstname: string; lastname: string }>) => void;
  disabled?: boolean;
  className?: string;
}

function parentLabel(p: Pick<Parent, 'firstname' | 'lastname'>): string {
  return `${p.firstname} ${p.lastname}`.trim() || '—';
}

function seedToParent(s: { id: string; firstname: string; lastname: string }): Parent {
  return {
    id: s.id,
    code: 0,
    firstname: s.firstname,
    lastname: s.lastname,
    studentIds: [],
    dynamicFields: {},
    createdAt: new Date().toISOString(),
  };
}

export function ParentSelect({
  value,
  onChange,
  requiredResult = [],
  levelId,
  classId,
  subjectId,
  seedParents = [],
  onParentsMetadataChange,
  disabled,
  className,
}: ParentSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const reqKey = useMemo(() => [...requiredResult].filter(Boolean).sort().join(','), [requiredResult]);

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['parents', 'select', debouncedSearch, reqKey, levelId ?? '', classId ?? '', subjectId ?? ''],
    queryFn: ({ pageParam }) =>
      parentApi.select({
        page: pageParam,
        limit: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        levelId,
        classId,
        subjectId,
        requiredResult: requiredResult.length ? requiredResult : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.success && last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: open || requiredResult.length > 0,
  });

  const loadedParents = useMemo(() => {
    const rows = data?.pages.flatMap((p) => p.data) ?? [];
    const seen = new Set<string>();
    const out: Parent[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out;
  }, [data]);

  /** Selected parents that only exist in seed (not yet returned in a page). */
  const listForCommand = useMemo(() => {
    const ids = new Set(loadedParents.map((p) => p.id));
    const extras: Parent[] = [];
    const sel = value ?? [];
    for (const s of seedParents) {
      if (sel.includes(s.id) && !ids.has(s.id)) {
        extras.push(seedToParent(s));
        ids.add(s.id);
      }
    }
    return [...extras, ...loadedParents];
  }, [seedParents, loadedParents, value]);

  const parentById = useMemo(() => {
    const m = new Map<string, Parent>();
    for (const s of seedParents) {
      m.set(s.id, seedToParent(s));
    }
    for (const p of loadedParents) {
      m.set(p.id, p);
    }
    return m;
  }, [seedParents, loadedParents]);

  const metaCbRef = useRef(onParentsMetadataChange);
  metaCbRef.current = onParentsMetadataChange;
  const loadedMetaKey = useMemo(
    () => loadedParents.map((p) => `${p.id}\0${p.firstname}\0${p.lastname}`).join('\n'),
    [loadedParents],
  );
  const seedMetaKey = useMemo(() => seedParents.map((s) => `${s.id}\0${s.firstname}\0${s.lastname}`).join('\n'), [seedParents]);

  useEffect(() => {
    const cb = metaCbRef.current;
    if (!cb) return;
    const o: Record<string, { firstname: string; lastname: string }> = {};
    for (const s of seedParents) {
      o[s.id] = { firstname: s.firstname, lastname: s.lastname };
    }
    for (const p of loadedParents) {
      o[p.id] = { firstname: p.firstname, lastname: p.lastname };
    }
    cb(o);
  }, [seedParents, loadedParents, loadedMetaKey, seedMetaKey]);

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  useInfiniteScrollSentinel(listRef, sentinelRef, open, !!hasNextPage, isFetchingNextPage, loadMore);

  const selectedParentIds = value ?? [];

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
          {selectedParentIds.length > 0 ? (
            <div className="flex flex-wrap gap-1 text-start">
              {selectedParentIds.slice(0, 2).map((id) => {
                const p = parentById.get(id);
                const label = p ? parentLabel(p) : id;
                return (
                  <Badge variant="secondary" key={id}>
                    {label}
                  </Badge>
                );
              })}
              {selectedParentIds.length > 2 && (
                <Badge variant="secondary">+{selectedParentIds.length - 2}</Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{t('common.selectParents')}</span>
          )}
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: '320px' }} align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('common.searchParents')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} className="max-h-64">
            {isLoading && listForCommand.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : null}
            {!isLoading && listForCommand.length === 0 ? (
              <CommandEmpty>{t('common.noParentsFound')}</CommandEmpty>
            ) : null}
            {listForCommand.length > 0 ? (
              <CommandGroup>
                {listForCommand.map((parent) => (
                  <CommandItem
                    key={parent.id}
                    value={parent.id}
                    onSelect={() => {
                      const current = value || [];
                      const updated = current.includes(parent.id)
                        ? current.filter((id) => id !== parent.id)
                        : [...current, parent.id];
                      onChange(updated);
                    }}
                  >
                    <Check
                      className={cn(
                        'me-2 h-4 w-4',
                        selectedParentIds.includes(parent.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {parentLabel(parent)}
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
