import { useState, useMemo, useEffect } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, KeyRound } from 'lucide-react';
import { managerApi, templateApi, ManagerImportValidationError } from '@/services/api';
import type { Manager } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DataTable, type Column } from '@/components/DataTable';
import { LevelSelect } from '@/components/selects/LevelSelect';
import { ClassSelect } from '@/components/selects/ClassSelect';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { ManagerFormDialog } from '@/components/ManagerFormDialog';
import { RegeneratePasswordDialog } from '@/components/RegeneratePasswordDialog';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

export default function ManagersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Manager | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Manager | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [importErrors, setImportErrors] = useState<{ row: number; errors: string[] }[] | null>(null);
  const [regenTarget, setRegenTarget] = useState<Manager | null>(null);

  const { data: managersRes, isLoading } = useQuery({
    queryKey: ['managers', { page, search, sortKey, sortOrder, filterLevel, filterClass }],
    queryFn: () =>
      managerApi.getAll({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        sortBy: sortKey ?? undefined,
        sortOrder: sortKey ? sortOrder : undefined,
        levelId: filterLevel === 'all' ? undefined : filterLevel,
        classId: filterClass === 'all' ? undefined : filterClass,
      }),
  });

  useEffect(() => {
    setPage(1);
  }, [search, filterLevel, filterClass, sortKey, sortOrder]);

  const { data: tplRes } = useQuery({ queryKey: ['templates'], queryFn: () => templateApi.get() });
  const fields = tplRes?.data?.manager?.fields || [];

  const createMut = useMutation({
    mutationFn: (d: Partial<Manager> & { password?: string }) => managerApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managers'] });
      setDialogOpen(false);
      toast.success(t('managers.created'));
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => managerApi.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managers'] });
      setDialogOpen(false);
      toast.success(t('managers.updated'));
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => managerApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managers'] });
      toast.success(t('managers.deleted'));
    },
  });

  const importMut = useMutation({
    mutationFn: (file: File) => managerApi.importExcel(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['managers'] });
      setImportOpen(false);
      setImportErrors(null);
      toast.success(
        t('common.imported', { count: data.imported, entity: t('nav.managers').toLowerCase() }),
      );
    },
    onError: (err: unknown) => {
      if (err instanceof ManagerImportValidationError) {
        setImportErrors(err.rowIssues);
        toast.error(err.message);
        return;
      }
      const msg = err instanceof Error ? err.message : t('import.failed');
      setImportErrors(null);
      toast.error(msg);
    },
  });

  const handleSubmit = (data: Record<string, unknown>) => {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...data });
    } else {
      createMut.mutate(data as Partial<Manager> & { password?: string });
    }
  };

  const columns: Column<Manager>[] = useMemo(() => {
    const base: Column<Manager>[] = [
      { key: 'code', label: t('common.code'), render: (m) => (m.code != null ? String(m.code) : '—') },
      { key: 'firstname', label: t('common.firstName') },
      { key: 'lastname', label: t('common.lastName') },
      {
        key: 'classIds',
        label: t('managers.classes'),
        render: (m) => m.classNames?.join(', ') || '—',
      },
    ];
    const dynamic = fields
      .filter((f) => f.visible)
      .slice(0, 2)
      .map((f) => ({
        key: f.name,
        label: f.label,
        render: (m: Manager) => String(m.dynamicFields?.[f.name] ?? '—'),
      }));
    return [...base, ...dynamic];
  }, [fields, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('managers.title')}</h1>
          <p className="text-muted-foreground">{t('managers.count', { count: managersRes?.total ?? 0 })}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t('managers.addManager')}
        </Button>
      </div>
      <FilterBar
        showClear={filterLevel !== 'all' || filterClass !== 'all'}
        onClear={() => {
          setFilterLevel('all');
          setFilterClass('all');
          setPage(1);
        }}
      >
        <LevelSelect
          className="w-[180px]"
          value={filterLevel}
          onChange={(v) => {
            setFilterLevel(v);
            setFilterClass('all');
          }}
          allOption={{ value: 'all', label: t('common.allLevels') }}
        />
        <ClassSelect
          className="w-[180px]"
          value={filterClass}
          onChange={setFilterClass}
          levelId={filterLevel === 'all' ? undefined : filterLevel}
          allOption={{ value: 'all', label: t('common.allClasses') }}
        />
      </FilterBar>
      <DataTable
        data={managersRes?.data || []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder={t('managers.searchManagers')}
        onView={(m) => navigate(`/managers/${m.id}`)}
        onEdit={(m) => {
          setEditing(m);
          setDialogOpen(true);
        }}
        onDelete={(m) => setDeleteTarget(m)}
        extraRowActions={(m) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t('students.regeneratePassword')}
            onClick={() => setRegenTarget(m)}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        )}
        exportFilename="managers"
        onImportClick={() => {
          setImportErrors(null);
          setImportOpen(true);
        }}
        onExportClick={() => {
          managerApi
            .exportExcel({
              classId: filterClass === 'all' ? undefined : filterClass,
              levelId: filterLevel === 'all' ? undefined : filterLevel,
              search: search.trim() || undefined,
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : t('export.failed')));
        }}
        onDownloadTemplate={() => {
          managerApi
            .downloadTemplate()
            .catch((e) => toast.error(e instanceof Error ? e.message : t('import.templateFailed')));
        }}
        serverSide={{
          total: managersRes?.total ?? 0,
          page,
          totalPages: managersRes?.totalPages ?? 1,
          search,
          sortKey,
          sortOrder,
          onSearchChange: setSearch,
          onSortChange: (key, order) => {
            setSortKey(key);
            setSortOrder(order);
          },
          onPageChange: setPage,
        }}
      />
      <ManagerFormDialog
        key={editing?.id ?? 'new-manager'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        fields={fields}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onSubmit={handleSubmit}
      />
      {regenTarget && (
        <RegeneratePasswordDialog
          open={!!regenTarget}
          onOpenChange={(o) => !o && setRegenTarget(null)}
          entityId={regenTarget.id}
          entityName={`${regenTarget.firstname} ${regenTarget.lastname}`}
          onRegenerate={managerApi.regeneratePassword}
        />
      )}
      <ExcelImportDialog
        importTarget="file"
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(file) => importMut.mutate(file)}
        expectedColumns={[t('import.managersExpectedColumnNames')]}
        isImporting={importMut.isPending}
        importErrors={importErrors ?? undefined}
        onDismissImportErrors={() => setImportErrors(null)}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('common.deleteConfirmTitle', { entity: t('nav.managers').toLowerCase() })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.deleteConfirmDesc', {
                name: `${deleteTarget?.firstname} ${deleteTarget?.lastname}`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMut.mutate(deleteTarget!.id);
                setDeleteTarget(null);
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
