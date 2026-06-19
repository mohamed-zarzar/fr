import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, XSquare, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ─── Reusable bulk selection hook ─────────────────────────────────
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when item count changes (e.g. filter applied)
  useEffect(() => { setSelectedIds(new Set()); }, [items.length]);

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === items.length ? new Set() : new Set(items.map(i => i.id))
    );
  }, [items]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  return {
    selectedIds,
    toggle,
    toggleAll,
    clear,
    isAllSelected: items.length > 0 && selectedIds.size === items.length,
    isIndeterminate: selectedIds.size > 0 && selectedIds.size < items.length,
    count: selectedIds.size,
  };
}

// ─── Bulk action bar component ────────────────────────────────────
interface BulkActionBarProps {
  selectedCount: number;
  onApprove: () => void;
  onRemoveApproval: () => void;
  onDelete: () => void;
  showDelete?: boolean;
}

export function BulkActionBar({ selectedCount, onApprove, onRemoveApproval, onDelete, showDelete = true }: BulkActionBarProps) {
  const { t } = useTranslation();
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-md border border-border">
      <span className="text-sm font-medium text-foreground">{t('common.selectedItems', { count: selectedCount })}</span>
      <div className="ms-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={onApprove}>
          <CheckSquare className="me-1 h-4 w-4" />{t('common.approve')}
        </Button>
        <Button size="sm" variant="outline" onClick={onRemoveApproval}>
          <XSquare className="me-1 h-4 w-4" />{t('common.removeApproval')}
        </Button>
        {showDelete && (
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="me-1 h-4 w-4" />{t('common.delete')}
          </Button>
        )}
      </div>
    </div>
  );
}
