import { useState, useMemo, useEffect } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, KeyRound } from 'lucide-react';
import { teacherApi, templateApi, TeacherImportValidationError } from '@/services/api';
import type { Teacher } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DataTable, type Column } from '@/components/DataTable';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { TeacherFormDialog } from '@/components/TeacherFormDialog';
import { RegeneratePasswordDialog } from '@/components/RegeneratePasswordDialog';
import { LevelSelect } from '@/components/selects/LevelSelect';
import { ClassSelect } from '@/components/selects/ClassSelect';
import { SubjectSelect } from '@/components/selects/SubjectSelect';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

export default function TeachersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [importErrors, setImportErrors] = useState<{ row: number; errors: string[] }[] | null>(null);
  const [regenTarget, setRegenTarget] = useState<Teacher | null>(null);

  const { data: teachersRes, isLoading } = useQuery({
    queryKey: ['teachers', { page, search, sortKey, sortOrder, filterLevel, filterClass, filterSubject }],
    queryFn: () =>
      teacherApi.getAll({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        sortBy: sortKey ?? undefined,
        sortOrder: sortKey ? sortOrder : undefined,
        levelId: filterLevel === 'all' ? undefined : filterLevel,
        classId: filterClass === 'all' ? undefined : filterClass,
        subjectId: filterSubject === 'all' ? undefined : filterSubject,
      }),
  });

  useEffect(() => {
    setPage(1);
  }, [search, filterLevel, filterClass, filterSubject, sortKey, sortOrder]);

  const { data: tplRes } = useQuery({ queryKey: ['templates'], queryFn: () => templateApi.get() });

  const fields = tplRes?.data?.teacher?.fields || [];

  const createMut = useMutation({
    mutationFn: (d: Partial<Teacher> & { password?: string }) => teacherApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      setDialogOpen(false);
      toast.success(t('teachers.created'));
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, unknown>) => teacherApi.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      setDialogOpen(false);
      toast.success(t('teachers.updated'));
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => teacherApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      toast.success(t('teachers.deleted'));
    },
  });

  const importMut = useMutation({
    mutationFn: (file: File) => teacherApi.importExcel(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      setImportOpen(false);
      setImportErrors(null);
      toast.success(
        t('common.imported', { count: data.imported, entity: t('nav.teachers').toLowerCase() }),
      );
    },
    onError: (err: unknown) => {
      if (err instanceof TeacherImportValidationError) {
        setImportErrors(err.rowIssues);
        toast.error(err.message);
        return;
      }
      const msg = err instanceof Error ? err.message : t('import.failed');
      setImportErrors(null);
      toast.error(msg);
    },
  });

  const columns: Column<Teacher>[] = useMemo(
    () => [
      { key: 'code', label: t('common.code'), render: (t2) => (t2.code != null ? String(t2.code) : '—') },
      { key: 'firstname', label: t('common.firstName') },
      { key: 'lastname', label: t('common.lastName') },
      {
        key: 'subjectIds',
        label: t('nav.subjects'),
        render: (t2) => t2.subjectNames?.join(', ') || '—',
      },
      {
        key: 'classAssignments' as keyof Teacher,
        label: t('nav.classes'),
        render: (t2: Teacher) => (t2.classNames?.length ? t2.classNames.join(', ') : '—'),
      },
      ...fields
        .filter((f) => f.visible)
        .slice(0, 2)
        .map((f) => ({
          key: f.name,
          label: f.label,
          render: (t2: Teacher) => String(t2.dynamicFields?.[f.name] ?? '—'),
        })),
    ],
    [fields, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('teachers.title')}</h1>
          <p className="text-muted-foreground">{t('teachers.count', { count: teachersRes?.total ?? 0 })}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t('teachers.addTeacher')}
        </Button>
      </div>
      <FilterBar
        showClear={filterLevel !== 'all' || filterClass !== 'all' || filterSubject !== 'all'}
        onClear={() => {
          setFilterLevel('all');
          setFilterClass('all');
          setFilterSubject('all');
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
        <SubjectSelect
          multiple={false}
          className="w-[180px]"
          value={filterSubject}
          onChange={(v) => setFilterSubject(typeof v === 'string' ? v : 'all')}
          allOption={{ value: 'all', label: t('common.allSubjects') }}
        />
      </FilterBar>
      <DataTable
        data={teachersRes?.data || []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder={t('teachers.searchTeachers')}
        onView={(t2) => navigate(`/teachers/${t2.id}`)}
        onEdit={(t2) => {
          setEditing(t2);
          setDialogOpen(true);
        }}
        onDelete={(t2) => setDeleteTarget(t2)}
        extraRowActions={(t2) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t('students.regeneratePassword')}
            onClick={() => setRegenTarget(t2)}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        )}
        exportFilename="teachers"
        onImportClick={() => {
          setImportErrors(null);
          setImportOpen(true);
        }}
        onExportClick={() => {
          teacherApi
            .exportExcel({
              levelId: filterLevel === 'all' ? undefined : filterLevel,
              classId: filterClass === 'all' ? undefined : filterClass,
              subjectId: filterSubject === 'all' ? undefined : filterSubject,
              search: search.trim() || undefined,
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : t('export.failed')));
        }}
        onDownloadTemplate={() => {
          teacherApi.downloadTemplate().catch((e) => toast.error(e instanceof Error ? e.message : t('import.templateFailed')));
        }}
        serverSide={{
          total: teachersRes?.total ?? 0,
          page,
          totalPages: teachersRes?.totalPages ?? 1,
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
      <TeacherFormDialog
        key={editing?.id ?? 'new-teacher'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        fields={fields}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onSubmit={(data) => (editing ? updateMut.mutate({ id: editing.id, ...data }) : createMut.mutate(data))}
      />
      <ExcelImportDialog
        importTarget="file"
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(file) => importMut.mutate(file)}
        expectedColumns={[t('import.teachersExpectedColumnNames')]}
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
          onRegenerate={teacherApi.regeneratePassword}
        />
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: t('nav.teachers').toLowerCase() })}</AlertDialogTitle>
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
