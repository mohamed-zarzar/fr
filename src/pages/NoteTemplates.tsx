import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { noteTemplateApi } from '@/services/note-point-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import type { NoteTemplate } from '@/types/note-point';

export default function NoteTemplates() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: res, isLoading } = useQuery({ queryKey: ['note-templates'], queryFn: () => noteTemplateApi.getAll() });
  const templates = res?.data || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<NoteTemplate | null>(null);

  const [form, setForm] = useState({ title: '', type: 'positive' as 'positive' | 'negative', isPointEffect: false, pointEffect: 0, isSendNotification: false });

  const createMut = useMutation({
    mutationFn: (d: Omit<NoteTemplate, 'id' | 'createdAt'>) => noteTemplateApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['note-templates'] }); setDialogOpen(false); toast.success(t('noteTemplates.templateCreated')); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Partial<NoteTemplate>) => noteTemplateApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['note-templates'] }); setDialogOpen(false); setEditing(null); toast.success(t('noteTemplates.templateUpdated')); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => noteTemplateApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['note-templates'] }); setDeleteId(null); toast.success(t('noteTemplates.templateDeleted')); },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', type: 'positive', isPointEffect: false, pointEffect: 0, isSendNotification: false });
    setDialogOpen(true);
  };

  const openEdit = (tpl: NoteTemplate) => {
    setEditing(tpl);
    setForm({ title: tpl.title, type: tpl.type, isPointEffect: tpl.isPointEffect, pointEffect: tpl.pointEffect, isSendNotification: tpl.isSendNotification });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error(t('noteTemplates.titleRequired')); return; }
    if (editing) updateMut.mutate({ id: editing.id, ...form });
    else createMut.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('noteTemplates.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('noteTemplates.subtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t('noteTemplates.addTemplate')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">{t('noteTemplates.noTemplates')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('noteTemplates.titleField')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead>{t('noteTemplates.pointEffect')}</TableHead>
                  <TableHead>{t('tabs.points')}</TableHead>
                  <TableHead>{t('common.notifications')}</TableHead>
                  <TableHead className="w-24">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(tpl => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium">{tpl.title}</TableCell>
                    <TableCell>
                      <Badge variant={tpl.type === 'positive' ? 'default' : 'destructive'}>
                        {tpl.type === 'positive' ? '+' : '−'} {tpl.type === 'positive' ? t('common.positive') : t('common.negative')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tpl.isPointEffect ? 'secondary' : 'outline'}>
                        {tpl.isPointEffect ? t('common.yes') : t('common.no')}
                      </Badge>
                    </TableCell>
                    <TableCell>{tpl.isPointEffect ? `${tpl.type === 'positive' ? '+' : '−'}${tpl.pointEffect}` : '—'}</TableCell>
                    <TableCell>
                      {tpl.isSendNotification ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(tpl.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? t('noteTemplates.editTemplate') : t('noteTemplates.newTemplate')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('noteTemplates.titleField')}</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Good Behavior" />
            </div>
            <div className="space-y-2">
              <Label>{t('common.type')}</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">{t('common.positive')}</SelectItem>
                  <SelectItem value="negative">{t('common.negative')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('noteTemplates.pointEffect')}</Label>
              <Switch checked={form.isPointEffect} onCheckedChange={v => setForm(f => ({ ...f, isPointEffect: v, pointEffect: v ? f.pointEffect || 1 : 0 }))} />
            </div>
            {form.isPointEffect && (
              <div className="space-y-2">
                <Label>{t('noteTemplates.pointsAmount')}</Label>
                <Input type="number" min={1} value={form.pointEffect} onChange={e => setForm(f => ({ ...f, pointEffect: parseInt(e.target.value) || 0 }))} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>{t('noteTemplates.sendNotification')}</Label>
              <Switch checked={form.isSendNotification} onCheckedChange={v => setForm(f => ({ ...f, isSendNotification: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('noteTemplates.deleteTemplate')}</AlertDialogTitle>
            <AlertDialogDescription>{t('noteTemplates.deleteTemplateDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
