import { useState, useMemo, useEffect } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, KeyRound } from 'lucide-react';
import { studentApi, templateApi, StudentImportValidationError } from '@/services/api';
import type { Student } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DataTable, type Column } from '@/components/DataTable';
import { LevelSelect } from '@/components/selects/LevelSelect';
import { ClassSelect } from '@/components/selects/ClassSelect';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { StudentFormDialog } from '@/components/StudentFormDialog';
import { RegeneratePasswordDialog } from '@/components/RegeneratePasswordDialog';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

export default function StudentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [importErrors, setImportErrors] = useState<{ row: number; errors: string[] }[] | null>(null);
  const [regenTarget, setRegenTarget] = useState<Student | null>(null);
  const [editDetailLoading, setEditDetailLoading] = useState(false);

  const { data: studentsRes, isLoading } = useQuery({
    queryKey: ['students', { page, search, sortKey, sortOrder, filterLevel, filterClass }],
    queryFn: () =>
      studentApi.getAll({
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

  const template = tplRes?.data?.student;
  const fields = template?.fields || [];

  const createMut = useMutation({
    mutationFn: (d: Partial<Student>) => studentApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); setDialogOpen(false); toast.success(t('students.created')); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => studentApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); setDialogOpen(false); toast.success(t('students.updated')); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => studentApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); toast.success(t('students.deleted')); },
  });

  const importMut = useMutation({
    mutationFn: (file: File) => studentApi.importExcel(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      setImportOpen(false);
      setImportErrors(null);
      toast.success(
        t('common.imported', { count: data.imported, entity: t('nav.students').toLowerCase() }),
      );
    },
    onError: (err: unknown) => {
      if (err instanceof StudentImportValidationError) {
        setImportErrors(err.rowIssues);
        toast.error(err.message);
        return;
      }
      const msg = err instanceof Error ? err.message : t('import.failed');
      setImportErrors(null);
      toast.error(msg);
    },
  });

  const columns: Column<Student>[] = useMemo(() => {
    const base: Column<Student>[] = [
      { key: 'code', label: t('common.code'), render: (s) => (s.code != null ? String(s.code) : '—') },
      { key: 'firstname', label: t('common.firstName') },
      { key: 'lastname', label: t('common.lastName') },
      { key: 'levelId', label: t('common.level'), render: s => s.levelName || s.levelId },
      { key: 'classId', label: t('students.class'), render: s => s.className || s.classId || '—' },
    ];
    const dynamic = fields.filter(f => f.visible).slice(0, 3).map(f => ({
      key: f.name, label: f.label, render: (s: Student) => String(s.dynamicFields?.[f.name] ?? '—'),
    }));
    return [...base, ...dynamic];
  }, [fields, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('students.title')}</h1>
          <p className="text-muted-foreground">{t('students.count', { count: studentsRes?.total ?? 0 })}</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="me-2 h-4 w-4" />{t('students.addStudent')}</Button>
      </div>
      <FilterBar showClear={filterLevel !== 'all' || filterClass !== 'all'} onClear={() => { setFilterLevel('all'); setFilterClass('all'); setPage(1); }}>
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
        data={studentsRes?.data || []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder={t('students.searchStudents')}
        onView={s => navigate(`/students/${s.id}`)}
        onEdit={async (s) => {
          setEditing(s);
          setDialogOpen(true);
          setEditDetailLoading(true);
          try {
            const res = await studentApi.getById(s.id);
            if (res.data) setEditing(res.data);
          } catch {
            // fallback to list-row data already set above
          } finally {
            setEditDetailLoading(false);
          }
        }}
        onDelete={s => setDeleteTarget(s)}
        extraRowActions={(s) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t('students.regeneratePassword')}
            onClick={() => setRegenTarget(s)}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        )}
        exportFilename="students"
        onImportClick={() => {
          setImportErrors(null);
          setImportOpen(true);
        }}
        onExportClick={() => {
          studentApi
            .exportExcel({
              levelId: filterLevel === 'all' ? undefined : filterLevel,
              classId: filterClass === 'all' ? undefined : filterClass,
              search: search.trim() || undefined,
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : t('export.failed')));
        }}
        onDownloadTemplate={() => {
          studentApi
            .downloadTemplate()
            .catch((e) => toast.error(e instanceof Error ? e.message : t('import.templateFailed')));
        }}
        serverSide={{
          total: studentsRes?.total ?? 0,
          page,
          totalPages: studentsRes?.totalPages ?? 1,
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

      <StudentFormDialog
        key={editing?.id ?? 'new-student'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        fields={fields}
        isSubmitting={createMut.isPending || updateMut.isPending || editDetailLoading}
        onSubmit={(data: any) => editing ? updateMut.mutate({ id: editing.id, ...data }) : createMut.mutate(data)}
      />

      <ExcelImportDialog
        importTarget="file"
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(file) => importMut.mutate(file)}
        expectedColumns={[t('import.studentsExpectedColumnNames')]}
        isImporting={importMut.isPending}
        importErrors={importErrors ?? undefined}
        onDismissImportErrors={() => setImportErrors(null)}
      />

      {regenTarget && (
        <RegeneratePasswordDialog
          open={!!regenTarget}
          onOpenChange={(o) => !o && setRegenTarget(null)}
          entityId={regenTarget.id}
          entityName={`${regenTarget.firstname} ${regenTarget.lastname}`}
          onRegenerate={studentApi.regeneratePassword}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: t('nav.students').toLowerCase() })}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.deleteConfirmDesc', { name: `${deleteTarget?.firstname} ${deleteTarget?.lastname}` })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteMut.mutate(deleteTarget!.id); setDeleteTarget(null); }}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
