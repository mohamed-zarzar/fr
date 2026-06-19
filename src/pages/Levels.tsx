import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { levelApi } from '@/services/api';
import type { Level } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, type Column } from '@/components/DataTable';
import { SubjectSelect } from '@/components/selects/SubjectSelect';
import { useTranslation } from 'react-i18next';

const schema = z.object({ name: z.string().min(1, 'Required'), description: z.string().optional(), subjectIds: z.array(z.string()).optional() });

export default function LevelsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Level | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Level | null>(null);

  const { data: res, isLoading } = useQuery({ queryKey: ['levels'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });

  type LevelFormValues = z.infer<typeof schema>;

  const createMut = useMutation({ mutationFn: (d: Partial<Level>) => levelApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['levels'] }); setDialogOpen(false); toast.success(t('levels.created')); } });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: LevelFormValues & { id: string }) => levelApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['levels'] }); setDialogOpen(false); toast.success(t('levels.updated')); },
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => levelApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['levels'] }); toast.success(t('levels.deleted')); } });

  const columns: Column<Level>[] = [
    { key: 'name', label: t('common.name') },
    { key: 'description', label: t('common.description') },
    {
      key: 'subjectIds' as keyof Level,
      label: t('tabs.subjects'),
      render: (l: Level) => (l.subjectNames?.length ? l.subjectNames.join(', ') : '—'),
    },
  ];
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', description: '', subjectIds: [] as string[] } });

  useEffect(() => {
    if (dialogOpen) {
      form.reset({ name: editing?.name || '', description: editing?.description || '', subjectIds: editing?.subjectIds || [] });
    }
  }, [dialogOpen, editing, form]);

  const handleSubmit = (data: LevelFormValues) => {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">{t('levels.title')}</h1><p className="text-muted-foreground">{t('levels.count', { count: res?.total ?? 0 })}</p></div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="me-2 h-4 w-4" />{t('levels.addLevel')}</Button>
      </div>
      <DataTable data={res?.data || []} columns={columns} isLoading={isLoading} searchPlaceholder={t('levels.searchLevels')} onEdit={l => { setEditing(l); setDialogOpen(true); }} onDelete={l => setDeleteTarget(l)} onView={l => navigate(`/levels/${l.id}`)} exportFilename="levels" />
      <Dialog open={dialogOpen} onOpenChange={o => setDialogOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t('levels.editLevel') : t('levels.addLevel')}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('common.name')} *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('common.description')}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField
                control={form.control}
                name="subjectIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tabs.subjects')}</FormLabel>
                    <FormControl>
                      <SubjectSelect
                        multiple
                        value={field.value ?? []}
                        onChange={(v) => field.onChange(v)}
                        requiredResult={editing?.subjectIds ?? []}
                        placeholder={t('common.selectSubjects')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{editing ? t('common.update') : t('common.create')}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: t('common.level') })}</AlertDialogTitle><AlertDialogDescription>{t('common.permanently', { name: deleteTarget?.name })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => { deleteMut.mutate(deleteTarget!.id); setDeleteTarget(null); }}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
