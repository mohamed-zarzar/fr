import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noteApi, noteTemplateApi } from '@/services/note-point-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FilterBar } from '@/components/FilterBar';
import { DatePickerField } from '@/components/DatePickerField';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  studentId: string;
  studentName: string;
}

const today = () => new Date().toISOString().split('T')[0];

export function StudentNotesTab({ studentId, studentName }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filterTemplateId, setFilterTemplateId] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [formTemplateId, setFormTemplateId] = useState('');
  const [formDate, setFormDate] = useState(today());
  const [formDesc, setFormDesc] = useState('');

  const { data: notesRes, isLoading } = useQuery({
    queryKey: ['student-notes', studentId, filterTemplateId, filterDateFrom, filterDateTo],
    queryFn: () => noteApi.getAll({
      studentId,
      templateId: filterTemplateId !== 'all' ? filterTemplateId : undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
    }),
  });
  const { data: templatesRes } = useQuery({ queryKey: ['note-templates'], queryFn: () => noteTemplateApi.getAll() });

  const notes = notesRes?.data || [];
  const templates = templatesRes?.data || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['student-notes'] });
    qc.invalidateQueries({ queryKey: ['student-points'] });
    qc.invalidateQueries({ queryKey: ['student-points-total'] });
  };

  const createMut = useMutation({
    mutationFn: (d: { templateId: string; studentId: string; date: string; description?: string }) => noteApi.create(d),
    onSuccess: () => { invalidate(); setAddOpen(false); toast.success(t('notes.noteAdded')); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => noteApi.delete(id),
    onSuccess: () => { invalidate(); setDeleteId(null); toast.success(t('notes.noteDeleted')); },
  });

  const getTemplateName = (id: string) => templates.find(t => t.id === id)?.title || id;
  const getTemplateType = (id: string) => templates.find(t => t.id === id)?.type;

  const openAdd = () => {
    setFormTemplateId('');
    setFormDate(today());
    setFormDesc('');
    setAddOpen(true);
  };

  const handleSubmit = () => {
    if (!formTemplateId) { toast.error(t('notes.selectType')); return; }
    createMut.mutate({ templateId: formTemplateId, studentId, date: formDate, description: formDesc || undefined });
  };

  const hasFilters = filterTemplateId !== 'all' || filterDateFrom || filterDateTo;

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;

  return (
    <div className="space-y-4">
      <FilterBar showClear={!!hasFilters} onClear={() => { setFilterTemplateId('all'); setFilterDateFrom(''); setFilterDateTo(''); }}>
        <div className="space-y-1">
          <Label className="text-xs">{t('notes.noteType')}</Label>
          <Select value={filterTemplateId} onValueChange={setFilterTemplateId}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allTypes')}</SelectItem>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex flex-col">
          <Label className="text-xs">{t('common.dateFrom')}</Label>
          <DatePickerField value={filterDateFrom} onChange={setFilterDateFrom} placeholder={t('common.dateFrom')} className="w-40" />
        </div>
        <div className="space-y-1 flex flex-col">
          <Label className="text-xs">{t('common.dateTo')}</Label>
          <DatePickerField value={filterDateTo} onChange={setFilterDateTo} placeholder={t('common.dateTo')} className="w-40" />
        </div>
      </FilterBar>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('tabs.notes')} — {studentName}</CardTitle>
          <Button size="sm" onClick={openAdd}><Plus className="me-2 h-4 w-4" />{t('notes.addNote')}</Button>
        </CardHeader>
        <CardContent className="p-0">
          {notes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t('notes.noNotes')}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('common.description')}</TableHead>
                    <TableHead className="w-16">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map(n => (
                    <TableRow key={n.id}>
                      <TableCell>{n.date}</TableCell>
                      <TableCell>
                        <Badge variant={getTemplateType(n.templateId) === 'positive' ? 'default' : 'destructive'}>
                          {getTemplateName(n.templateId)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-64 truncate">{n.description || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('notes.addNote')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('notes.noteType')}</Label>
              <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                <SelectTrigger><SelectValue placeholder={t('notes.selectType')} /></SelectTrigger>
                <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.title} ({t.type})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.date')}</Label>
              <DatePickerField value={formDate} onChange={setFormDate} />
            </div>
            <div className="space-y-2">
              <Label>{t('common.description')} ({t('common.none').toLowerCase()})</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder={t('notes.addDescription')} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>{t('notes.addNote')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('notes.deleteNote')}</AlertDialogTitle><AlertDialogDescription>{t('notes.deleteNoteDesc')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
