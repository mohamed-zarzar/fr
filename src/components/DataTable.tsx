import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Pencil, Trash2, ArrowUpDown, Download, Upload, FileDown } from 'lucide-react';
import { exportToExcel } from '@/lib/excel-utils';
import { useTranslation } from 'react-i18next';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
}

export type ServerSideTableConfig = {
  total: number;
  /** 1-based page index */
  page: number;
  totalPages: number;
  search: string;
  sortKey: string | null;
  sortOrder: 'asc' | 'desc';
  onSearchChange: (q: string) => void;
  onSortChange: (key: string, order: 'asc' | 'desc') => void;
  /** 1-based */
  onPageChange: (page: number) => void;
};

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Shared pagination footer (1-based `page`). */
export function Pagination({ page, totalPages, total, onPageChange, disabled }: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 1 && total === 0) {
    return null;
  }
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {t('common.page')} {page} {t('common.of')} {Math.max(1, totalPages)} · {total} {t('common.records')}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={disabled || page <= 1}
        >
          {t('common.previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={disabled || page >= totalPages || totalPages === 0}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  /** Extra action buttons rendered after the standard actions for each row. */
  extraRowActions?: (item: T) => ReactNode;
  isLoading?: boolean;
  pageSize?: number;
  exportFilename?: string;
  /** When set, Export uses this instead of client-side `exportToExcel`. */
  onExportClick?: () => void;
  onImportClick?: () => void;
  onDownloadTemplate?: () => void;
  /** When set, search/sort/pagination are controlled by the parent (server-side). */
  serverSide?: ServerSideTableConfig;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchPlaceholder,
  onEdit,
  onDelete,
  onView,
  extraRowActions,
  isLoading,
  pageSize = 10,
  exportFilename,
  onExportClick,
  onImportClick,
  onDownloadTemplate,
  serverSide,
}: Props<T>) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const isServer = !!serverSide;

  /** Local search text in server mode (debounced before notifying parent). */
  const [serverSearchInput, setServerSearchInput] = useState(() => serverSide?.search ?? '');
  const onSearchChangeRef = useRef(serverSide?.onSearchChange);
  onSearchChangeRef.current = serverSide?.onSearchChange;

  useEffect(() => {
    if (isServer && serverSide) {
      setSortKey(serverSide.sortKey);
      setSortOrder(serverSide.sortOrder);
    }
  }, [isServer, serverSide?.sortKey, serverSide?.sortOrder]);

  /** Keep input in sync when parent search changes externally (e.g. clear filters). */
  useEffect(() => {
    if (!isServer) return;
    setServerSearchInput(serverSide?.search ?? '');
  }, [isServer, serverSide?.search]);

  /** Debounced server search: avoid refetch + focus loss on every keystroke. */
  useEffect(() => {
    if (!isServer) return;
    const timer = setTimeout(() => {
      onSearchChangeRef.current?.(serverSearchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [isServer, serverSearchInput]);

  const filtered = useMemo(() => {
    if (isServer) return data;
    let items = data;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(item =>
        columns.some(col => {
          const val = col.render ? '' : (item as any)[col.key];
          return typeof val === 'string' && val.toLowerCase().includes(q);
        }) || Object.values((item as any).dynamicFields || {}).some(v => typeof v === 'string' && (v as string).toLowerCase().includes(q))
        || String((item as any).firstname || '').toLowerCase().includes(q)
        || String((item as any).lastname || '').toLowerCase().includes(q)
        || String((item as any).code ?? '').toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      items = [...items].sort((a, b) => {
        const aVal = String((a as any)[sortKey] ?? (a as any).dynamicFields?.[sortKey] ?? '');
        const bVal = String((b as any)[sortKey] ?? (b as any).dynamicFields?.[sortKey] ?? '');
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return items;
  }, [data, search, sortKey, sortOrder, columns, isServer]);

  const totalPagesClient = Math.ceil(filtered.length / pageSize);
  const paginated = isServer ? data : filtered.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: string) => {
    if (isServer && serverSide) {
      if (serverSide.sortKey === key) {
        serverSide.onSortChange(key, serverSide.sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        serverSide.onSortChange(key, 'asc');
      }
      return;
    }
    if (sortKey === key) setSortOrder(p => p === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('asc'); }
  };

  const searchInputValue = isServer && serverSide ? serverSearchInput : search;
  const onSearchInputChange = (v: string) => {
    if (isServer && serverSide) {
      setServerSearchInput(v);
    } else {
      setSearch(v);
      setPage(0);
    }
  };

  const rowsForExport = isServer ? data : filtered;

  const actionColCount = (onView || onEdit || onDelete || extraRowActions) ? 1 : 0;
  const tableColSpan = columns.length + actionColCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder={searchPlaceholder || `${t('common.search')}...`}
          value={searchInputValue}
          onChange={e => onSearchInputChange(e.target.value)}
          className="max-w-sm"
        />
        <div className="ms-auto flex flex-wrap gap-2">
          {onDownloadTemplate && (
            <Button variant="outline" size="sm" onClick={onDownloadTemplate}>
              <FileDown className="me-2 h-4 w-4" />
              {t('common.downloadTemplate')}
            </Button>
          )}
          {onImportClick && (
            <Button variant="outline" size="sm" onClick={onImportClick}>
              <Upload className="me-2 h-4 w-4" />{t('common.import')}
            </Button>
          )}
          {(onExportClick || exportFilename) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onExportClick
                  ? onExportClick()
                  : exportFilename
                    ? exportToExcel(rowsForExport, columns, exportFilename)
                    : undefined
              }
            >
              <Download className="me-2 h-4 w-4" />{t('common.export')}
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key} className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(col.key)}>
                  <span className="inline-flex items-center gap-1">{col.label} <ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                </TableHead>
              ))}
              {(onView || onEdit || onDelete || extraRowActions) && <TableHead className="w-24">{t('common.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`loading-${i}`}>
                  <TableCell colSpan={tableColSpan}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow><TableCell colSpan={tableColSpan} className="text-center text-muted-foreground py-8">{t('common.noRecords')}</TableCell></TableRow>
            ) : (
              paginated.map(item => (
                <TableRow key={item.id}>
                  {columns.map(col => (
                    <TableCell key={col.key} className="whitespace-nowrap">
                      {col.render ? col.render(item) : String((item as any)[col.key] ?? '')}
                    </TableCell>
                  ))}
                  {(onView || onEdit || onDelete || extraRowActions) && (
                    <TableCell>
                      <div className="flex gap-1">
                        {onView && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(item)}><Eye className="h-4 w-4" /></Button>}
                        {onEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}><Pencil className="h-4 w-4" /></Button>}
                        {onDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4" /></Button>}
                        {extraRowActions?.(item)}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {isServer && serverSide ? (
        (serverSide.totalPages > 1 || serverSide.total > 0) && (
          <Pagination
            page={serverSide.page}
            totalPages={Math.max(1, serverSide.totalPages)}
            total={serverSide.total}
            onPageChange={serverSide.onPageChange}
          />
        )
      ) : (
        totalPagesClient > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t('common.page')} {page + 1} {t('common.of')} {totalPagesClient} · {filtered.length} {t('common.records')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>{t('common.previous')}</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPagesClient - 1, p + 1))} disabled={page >= totalPagesClient - 1}>{t('common.next')}</Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
