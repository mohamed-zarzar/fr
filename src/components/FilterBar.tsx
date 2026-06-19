import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FilterBarProps {
  children: ReactNode;
  onClear?: () => void;
  showClear?: boolean;
}

export function FilterBar({ children, onClear, showClear = false }: FilterBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-end gap-3 flex-wrap rounded-lg border bg-card p-3">
      {children}
      {showClear && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
          {t('common.clearFilters')}
        </Button>
      )}
    </div>
  );
}
