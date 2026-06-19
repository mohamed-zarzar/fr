import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { subjectApi, SubjectImportValidationError } from '@/services/api';
import type { Subject } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type Column } from '@/components/DataTable';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

export default function SubjectsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [importErrors, setImportErrors] = useState<{ row: number; errors: string[] }[] | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('common.required')),
        code: z.string().min(1, t('common.required')),
        description: z.string().optional(),
        type: z.enum(['NORMAL', 'MAIN']).default('NORMAL'),
        childIds: z.array(z.string()).optional(),
      }),
    [t],
  );

  const { data: res, isLoading } = useQuery({
    queryKey: ['subjects', { page, search, sortKey, sortOrder }],
    queryFn: () =>
      subjectApi.getAll({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        sortBy: sortKey ?? undefined,
        sortOrder: sortKey ? sortOrder : undefined,
      }),
  });

  // All NORMAL subjects for children multi-select (load all, up to 200)
  const { data: allNormalRes } = useQuery({
    queryKey: ['subjects-all-normal'],
    queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }),
  });
  const normalSubjects = (allNormalRes?.data ?? []).filter((s) => s.type === 'NORMAL');

  // Fetch full subject detail when editing to get children (list API omits children)
  const { data: editingDetailRes } = useQuery({
    queryKey: ['subject', editing?.id],
    queryFn: () => subjectApi.getById(editing!.id),
    enabled: !!editing?.id,
  });

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortOrder]);

  const createMut = useMutation({
    mutationFn: (d: Partial<Subject> & { childIds?: string[] }) => subjectApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['subjects-all-normal'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(t('subjects.created'));
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => subjectApi.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['subjects-all-normal'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(t('subjects.updated'));
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => subjectApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['subjects-all-normal'] });
      toast.success(t('subjects.deleted'));
    },
  });

  const importMut = useMutation({
    mutationFn: (file: File) => subjectApi.importExcel(file),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setImportOpen(false);
      setImportErrors(null);
      toast.success(
        t('common.imported', { count: data.imported, entity: t('nav.subjects').toLowerCase() }),
      );
    },
    onError: (err: unknown) => {
      if (err instanceof SubjectImportValidationError) {
        setImportErrors(err.rowIssues);
        toast.error(err.message);
        return;
      }
      const msg = err instanceof Error ? err.message : t('import.failed');
      setImportErrors(null);
      toast.error(msg);
    },
  });

  const columns: Column<Subject>[] = useMemo(
    () => [
      { key: 'name', label: t('common.name') },
      { key: 'code', label: t('common.code') },
      {
        key: 'type' as any,
        label: t('subjects.subjectType'),
        render: (s) =>
          s.type === 'MAIN' ? (
            <Badge variant="secondary">{t('subjects.typeMain')}</Badge>
          ) : (
            <Badge variant="outline">{t('subjects.typeNormal')}</Badge>
          ),
      },
      {
        key: 'description',
        label: t('common.description'),
        render: (s) => (s.description?.trim() ? s.description : '—'),
      },
    ],
    [t],
  );

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', description: '', type: 'NORMAL' as 'NORMAL' | 'MAIN', childIds: [] as string[] },
  });
  const watchType = form.watch('type');

  useEffect(() => {
    if (dialogOpen) {
      const fullEditing = editingDetailRes?.data ?? editing;
      form.reset({
        name: fullEditing?.name || '',
        code: fullEditing?.code || '',
        description: fullEditing?.description || '',
        type: (fullEditing?.type as 'NORMAL' | 'MAIN') || 'NORMAL',
        childIds: fullEditing?.children?.map((c) => c.id) || [],
      });
    }
  }, [dialogOpen, editing, editingDetailRes]);

  const handleSubmit = (data: { name: string; code: string; description?: string; type: 'NORMAL' | 'MAIN'; childIds?: string[] }) => {
    const payload = {
      name: data.name,
      code: data.code,
      description: data.description,
      type: data.type,
      childIds: data.type === 'MAIN' ? (data.childIds ?? []) : [],
    };
    editing ? updateMut.mutate({ id: editing.id, ...payload }) : createMut.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('subjects.title')}</h1>
          <p className="text-muted-foreground">{t('subjects.count', { count: res?.total ?? 0 })}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t('subjects.addSubject')}
        </Button>
      </div>
      <DataTable
        data={res?.data || []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder={t('subjects.searchSubjects')}
        onEdit={(s) => {
          setEditing(s);
          setDialogOpen(true);
        }}
        onDelete={(s) => setDeleteTarget(s)}
        onView={(s) => navigate(`/subjects/${s.id}`)}
        exportFilename="subjects"
        onImportClick={() => {
          setImportErrors(null);
          setImportOpen(true);
        }}
        onExportClick={() => {
          subjectApi
            .exportExcel({ search: search.trim() || undefined })
            .catch((e) => toast.error(e instanceof Error ? e.message : t('export.failed')));
        }}
        onDownloadTemplate={() => {
          subjectApi
            .downloadTemplate()
            .catch((e) => toast.error(e instanceof Error ? e.message : t('import.templateFailed')));
        }}
        serverSide={{
          total: res?.total ?? 0,
          page,
          totalPages: res?.totalPages ?? 1,
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
        key={editing?.id ?? 'new-subject'}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('subjects.editSubject') : t('subjects.addSubject')}</DialogTitle>
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
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.code')} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('subjects.subjectType')}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">{t('subjects.typeNormal')}</SelectItem>
                          <SelectItem value="MAIN">{t('subjects.typeMain')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchType === 'MAIN' && (
                <Controller
                  control={form.control}
                  name="childIds"
                  render={({ field }) => {
                    const selected = field.value ?? [];
                    const candidates = normalSubjects.filter(
                      (s) => s.id !== editing?.id,
                    );
                    return (
                      <FormItem>
                        <FormLabel>{t('subjects.childSubjects')}</FormLabel>
                        <p className="text-xs text-muted-foreground">{t('subjects.childSubjectsHelp')}</p>
                        <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                          {candidates.length === 0 && (
                            <p className="text-sm text-muted-foreground">{t('subjects.noComponents')}</p>
                          )}
                          {candidates.map((s) => (
                            <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={selected.includes(s.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...selected, s.id]);
                                  } else {
                                    field.onChange(selected.filter((id) => id !== s.id));
                                  }
                                }}
                              />
                              <span className="text-sm">{s.name} <span className="text-muted-foreground text-xs">({s.code})</span></span>
                            </label>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              )}
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
        expectedColumns={[t('import.subjectsExpectedColumnNames')]}
        isImporting={importMut.isPending}
        importErrors={importErrors ?? undefined}
        onDismissImportErrors={() => setImportErrors(null)}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('common.deleteConfirmTitle', { entity: t('common.subject') })}
            </AlertDialogTitle>
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
