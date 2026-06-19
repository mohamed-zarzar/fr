import { useCallback, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { teacherApi } from '@/services/api';
import type { Teacher } from '@/types';
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
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useInfiniteScrollSentinel } from '@/hooks/useInfiniteScrollSentinel';

const PAGE_SIZE = 10;

export type TeacherSelectAllOption = { value: string; label: string };

export interface TeacherSelectProps {
  value: string;
  onChange: (teacherId: string) => void;
  placeholder?: string;
  requiredResult?: string[];
  levelId?: string;
  classId?: string;
  subjectId?: string;
  disabledIds?: string[];
  className?: string;
  disabled?: boolean;
  allOption?: TeacherSelectAllOption;
}

export function TeacherSelect({
  value,
  onChange,
  placeholder,
  requiredResult = [],
  levelId,
  classId,
  subjectId,
  disabledIds = [],
  className,
  disabled,
  allOption,
}: TeacherSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cachedItem, setCachedItem] = useState<Teacher | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const reqKey = useMemo(() => [...requiredResult].filter(Boolean).sort().join(','), [requiredResult]);
  const disabledSet = useMemo(() => new Set(disabledIds.filter(Boolean)), [disabledIds]);

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['teachers', 'select', debouncedSearch, reqKey, levelId ?? '', classId ?? '', subjectId ?? ''],
    queryFn: ({ pageParam }) =>
      teacherApi.select({
        page: pageParam,
        limit: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        levelId: levelId || undefined,
        classId: classId || undefined,
        subjectId: subjectId || undefined,
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
    const out: Teacher[] = [];
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

  const displayLabel = useMemo(() => {
    if (allOption && value === allOption.value) return allOption.label;
    const found = items.find((t) => t.id === value);
    if (found) return `${found.firstname} ${found.lastname}`;
    if (cachedItem && cachedItem.id === value) return `${cachedItem.firstname} ${cachedItem.lastname}`;
    return '';
  }, [allOption, value, items, cachedItem]);

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
            {displayLabel || placeholder || t('common.selectTeacher', { defaultValue: 'Select teacher' })}
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
                  <Check className={cn('me-2 h-4 w-4', value === allOption.value ? 'opacity-100' : 'opacity-0')} />
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
                {items.map((t) => {
                  const rowDisabled = disabledSet.has(t.id);
                  const label = `${t.firstname} ${t.lastname}`;
                  return (
                    <CommandItem
                      key={t.id}
                      value={t.id}
                      disabled={rowDisabled}
                      onSelect={() => {
                        if (rowDisabled) return;
                        setCachedItem(t);
                        onChange(t.id);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Check className={cn('me-2 h-4 w-4', value === t.id ? 'opacity-100' : 'opacity-0')} />
                      {label}
                    </CommandItem>
                  );
                })}
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
