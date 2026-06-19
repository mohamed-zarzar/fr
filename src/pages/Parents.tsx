import { useState, useMemo, useEffect } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, KeyRound } from 'lucide-react';
import { parentApi, templateApi, ParentImportValidationError } from '@/services/api';
import type { Parent } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DataTable, type Column } from '@/components/DataTable';
import { LevelSelect } from '@/components/selects/LevelSelect';
import { ClassSelect } from '@/components/selects/ClassSelect';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { ParentFormDialog } from '@/components/ParentFormDialog';
import { RegeneratePasswordDialog } from '@/components/RegeneratePasswordDialog';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

export default function ParentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [importErrors, setImportErrors] = useState<{ row: number; errors: string[] }[] | null>(null);
  const [regenTarget, setRegenTarget] = useState<Parent | null>(null);

  const { data: parentsRes, isLoading } = useQuery({
    queryKey: ['parents', { page, search, sortKey, sortOrder, filterLevel, filterClass }],
    queryFn: () =>
      parentApi.getAll({
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

  const fields = tplRes?.data?.parent?.fields || [];

  const createMut = useMutation({
    mutationFn: (d: Partial<Parent> & { password?: string }) => parentApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      setDialogOpen(false);
      toast.success(t('parents.created'));
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Partial<Parent>) => parentApi.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      setDialogOpen(false);
      toast.success(t('parents.updated'));
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => parentApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      toast.success(t('parents.deleted'));
    },
  });

  const importMut = useMutation({
    mutationFn: (file: File) => parentApi.importExcel(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      setImportOpen(false);
      setImportErrors(null);
      toast.success(
        t('common.imported', { count: data.imported, entity: t('nav.parents').toLowerCase() }),
      );
    },
    onError: (err: unknown) => {
      if (err instanceof ParentImportValidationError) {
        setImportErrors(err.rowIssues);
        toast.error(err.message);
        return;
      }
      const msg = err instanceof Error ? err.message : t('import.failed');
      setImportErrors(null);
      toast.error(msg);
    },
  });

  const submitParent = (payload: Partial<Parent> & { password?: string }) => {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const columns: Column<Parent>[] = useMemo(() => {
    const base: Column<Parent>[] = [
      { key: 'code', label: t('common.code'), render: (p) => (p.code != null ? String(p.code) : '—') },
      { key: 'firstname', label: t('common.firstName') },
      { key: 'lastname', label: t('common.lastName') },
      {
        key: 'studentIds',
        label: t('common.children'),
        render: (p) => t('parents.studentCount', { count: p.studentCount ?? p.studentIds.length }),
      },
    ];
    const dynamic = fields
      .filter((f) => f.visible)
      .slice(0, 2)
      .map((f) => ({
        key: f.name,
        label: f.label,
        render: (p: Parent) => String(p.dynamicFields?.[f.name] ?? '—'),
      }));
    return [...base, ...dynamic];
  }, [fields, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('parents.title')}</h1>
          <p className="text-muted-foreground">{t('parents.count', { count: parentsRes?.total ?? 0 })}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t('parents.addParent')}
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
        data={parentsRes?.data || []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder={t('parents.searchParents')}
        onView={(p) => navigate(`/parents/${p.id}`)}
        onEdit={(p) => {
          setEditing(p);
          setDialogOpen(true);
        }}
        onDelete={(p) => setDeleteTarget(p)}
        extraRowActions={(p) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t('students.regeneratePassword')}
            onClick={() => setRegenTarget(p)}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        )}
        exportFilename="parents"
        onImportClick={() => {
          setImportErrors(null);
          setImportOpen(true);
        }}
        onExportClick={() => {
          parentApi
            .exportExcel({
              levelId: filterLevel === 'all' ? undefined : filterLevel,
              classId: filterClass === 'all' ? undefined : filterClass,
              search: search.trim() || undefined,
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : t('export.failed')));
        }}
        onDownloadTemplate={() => {
          parentApi
            .downloadTemplate()
            .catch((e) => toast.error(e instanceof Error ? e.message : t('import.templateFailed')));
        }}
        serverSide={{
          total: parentsRes?.total ?? 0,
          page,
          totalPages: parentsRes?.totalPages ?? 1,
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
      <ParentFormDialog
        key={editing?.id ?? 'new-parent'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        fields={fields}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onSubmit={submitParent}
        title={t('common.parent')}
      />

      {regenTarget && (
        <RegeneratePasswordDialog
          open={!!regenTarget}
          onOpenChange={(o) => !o && setRegenTarget(null)}
          entityId={regenTarget.id}
          entityName={`${regenTarget.firstname} ${regenTarget.lastname}`}
          onRegenerate={parentApi.regeneratePassword}
        />
      )}
      <ExcelImportDialog
        importTarget="file"
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(file) => importMut.mutate(file)}
        expectedColumns={[t('import.parentsExpectedColumnNames')]}
        isImporting={importMut.isPending}
        importErrors={importErrors ?? undefined}
        onDismissImportErrors={() => setImportErrors(null)}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('common.deleteConfirmTitle', { entity: t('nav.parents').toLowerCase() })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.deleteConfirmDesc', { name: `${deleteTarget?.firstname} ${deleteTarget?.lastname}` })}
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
