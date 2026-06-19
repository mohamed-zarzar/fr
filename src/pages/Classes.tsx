import { useState, useMemo, useEffect } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { classApi } from '@/services/api';
import type { SchoolClass } from '@/types';
import { APP_CONFIG } from '@/config';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/DataTable';
import { LevelSelect } from '@/components/selects/LevelSelect';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

const schema = z.object({
  name: z.string().min(1, 'Required'),
  section: z.string().optional(),
  capacity: z.coerce.number().min(1, 'Min 1'),
  levelId: z.string().min(1, 'Required'),
});

export default function ClassesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolClass | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [importErrors, setImportErrors] = useState<{ row: number; errors: string[] }[] | null>(null);

  const { data: classesRes, isLoading } = useQuery({
    queryKey: ['classes', { page, search, sortKey, sortOrder, filterLevel }],
    queryFn: () =>
      classApi.getAll({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        sortBy: sortKey ?? undefined,
        sortOrder: sortKey ? sortOrder : undefined,
        levelId: filterLevel === 'all' ? undefined : filterLevel,
      }),
  });

  useEffect(() => {
    setPage(1);
  }, [search, filterLevel, sortKey, sortOrder]);

  const createMut = useMutation({
    mutationFn: (d: Partial<SchoolClass>) => classApi.create(d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      if (res?.data?.id) qc.invalidateQueries({ queryKey: ['class', res.data.id] });
      setDialogOpen(false);
      toast.success(t('classes.created'));
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Partial<SchoolClass>) => classApi.update(id, d),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      qc.invalidateQueries({ queryKey: ['class', variables.id] });
      setDialogOpen(false);
      toast.success(t('classes.updated'));
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => classApi.delete(id),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      qc.invalidateQueries({ queryKey: ['class', deletedId] });
      toast.success(t('classes.deleted'));
    },
  });

  const importMut = useMutation({
    mutationFn: (file: File) => classApi.importExcel(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      setImportOpen(false);
      setImportErrors(null);
      toast.success(
        t('common.imported', { count: data.imported, entity: t('nav.classes').toLowerCase() }),
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : t('import.failed');
      setImportErrors(null);
      toast.error(msg);
    },
  });

  const columns: Column<SchoolClass>[] = useMemo(() => {
    const base: Column<SchoolClass>[] = [
      { key: 'name', label: t('common.name') },
      ...(APP_CONFIG.USE_MOCK_API
        ? [{ key: 'section', label: t('common.section'), render: (c: SchoolClass) => c.section ?? '—' } as Column<SchoolClass>]
        : []),
      { key: 'capacity', label: t('common.capacity'), render: (c) => String(c.capacity) },
      {
        key: 'levelId',
        label: t('common.level'),
        render: (c) => c.level?.name ?? c.levelId,
      },
    ];
    return base;
  }, [t]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', section: '', capacity: 30, levelId: '' },
  });
  const resetForm = () => {
    form.reset({
      name: editing?.name || '',
      section: editing?.section || '',
      capacity: editing?.capacity ?? 30,
      levelId: editing?.levelId || '',
    });
  };
  const handleSubmit = (data: z.infer<typeof schema>) => {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('classes.title')}</h1>
          <p className="text-muted-foreground">{t('classes.count', { count: classesRes?.total ?? 0 })}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t('classes.addClass')}
        </Button>
      </div>

      <FilterBar showClear={filterLevel !== 'all'} onClear={() => { setFilterLevel('all'); setPage(1); }}>
        <LevelSelect
          className="w-[180px]"
          value={filterLevel}
          onChange={(v) => {
            setFilterLevel(v);
            setPage(1);
          }}
          allOption={{ value: 'all', label: t('common.allLevels') }}
        />
      </FilterBar>

      <DataTable
        data={classesRes?.data || []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder={t('classes.searchClasses')}
        onView={(c) => navigate(`/classes/${c.id}`)}
        onEdit={(c) => {
          setEditing(c);
          setDialogOpen(true);
        }}
        onDelete={(c) => setDeleteTarget(c)}
        exportFilename="classes"
        onImportClick={() => {
          setImportErrors(null);
          setImportOpen(true);
        }}
        onExportClick={() => {
          classApi
            .exportExcel({
              levelId: filterLevel === 'all' ? undefined : filterLevel,
              search: search.trim() || undefined,
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : t('export.failed')));
        }}
        onDownloadTemplate={() => {
          classApi
            .downloadTemplate()
            .catch((e) => toast.error(e instanceof Error ? e.message : t('import.templateFailed')));
        }}
        serverSide={{
          total: classesRes?.total ?? 0,
          page,
          totalPages: classesRes?.totalPages ?? 1,
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (o) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('classes.editClass') : t('classes.addClass')}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.name')} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {APP_CONFIG.USE_MOCK_API && (
                <FormField
                  control={form.control}
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.section')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.capacity')} *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="levelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.level')} *</FormLabel>
                    <FormControl>
                      <LevelSelect
                        value={field.value}
                        onChange={field.onChange}
                        requiredResult={editing?.levelId ? [editing.levelId] : []}
                        placeholder={t('common.selectLevel')}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {editing ? t('common.update') : t('common.create')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ExcelImportDialog
        importTarget="file"
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(file) => importMut.mutate(file)}
        expectedColumns={[t('import.classesExpectedColumnNames')]}
        isImporting={importMut.isPending}
        importErrors={importErrors ?? undefined}
        onDismissImportErrors={() => setImportErrors(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: t('common.class') })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.permanently', { name: deleteTarget?.name })}
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
