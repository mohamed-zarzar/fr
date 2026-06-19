import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '@/services/settings-api';
import type { SessionDefinition } from '@/services/settings-api';
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

export type SessionSelectAllOption = { value: string; label: string };

export interface SessionSelectProps {
  value: string;
  onChange: (sessionId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allOption?: SessionSelectAllOption;
}

export function SessionSelect({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  allOption,
}: SessionSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: sessionsResult, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => settingsApi.getSessions(),
    staleTime: 5 * 60 * 1000,
  });

  const items: SessionDefinition[] = useMemo(
    () => sessionsResult?.data ?? [],
    [sessionsResult],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => s.name.toLowerCase().includes(q));
  }, [items, search]);

  const displayLabel = useMemo(() => {
    if (allOption && value === allOption.value) return allOption.label;
    return items.find((s) => s.id === value)?.name ?? '';
  }, [allOption, value, items]);

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
            {displayLabel || placeholder || t('common.selectSession', { defaultValue: 'Select session' })}
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
          <CommandList className="max-h-64">
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
            {isLoading && filteredItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : null}
            {!isLoading && filteredItems.length === 0 && !allOption ? (
              <CommandEmpty>{t('common.noResults', { defaultValue: 'No results' })}</CommandEmpty>
            ) : null}
            {filteredItems.length > 0 ? (
              <CommandGroup>
                {filteredItems.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      onChange(s.id);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check className={cn('me-2 h-4 w-4', value === s.id ? 'opacity-100' : 'opacity-0')} />
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
