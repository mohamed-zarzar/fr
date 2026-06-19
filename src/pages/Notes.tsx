import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { noteApi, noteTemplateApi } from '@/services/note-point-api';
import { studentApi, classApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FilterBar } from '@/components/FilterBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerField } from '@/components/DatePickerField';
import { AttendanceQRScanner } from '@/components/AttendanceQRScanner';
import { BulkActionBar, useBulkSelection } from '@/components/BulkActionBar';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { Plus, Trash2, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { Note } from '@/types/note-point';

const today = () => new Date().toISOString().split('T')[0];

export default function Notes() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<{ studentId?: string; templateId?: string; dateFrom?: string; dateTo?: string }>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formTemplateId, setFormTemplateId] = useState('');
  const [formStudentIds, setFormStudentIds] = useState<string[]>([]);
  const [formDate, setFormDate] = useState(today());
  const [formDesc, setFormDesc] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Bulk state
  const [bulkRowCount, setBulkRowCount] = useState(3);
  const [bulkShared, setBulkShared] = useState(true);
  const [bulkSharedTemplateId, setBulkSharedTemplateId] = useState('');
  const [bulkSharedDate, setBulkSharedDate] = useState(today());
  const [bulkRows, setBulkRows] = useState<{ templateId: string; studentIds: string[]; date: string; description: string }[]>([
    { templateId: '', studentIds: [], date: today(), description: '' }
  ]);

  const { data: templatesRes } = useQuery({ queryKey: ['note-templates'], queryFn: () => noteTemplateApi.getAll() });
  const { data: notesRes, isLoading } = useQuery({ queryKey: ['notes', filter], queryFn: () => noteApi.getAll(filter) });
  const { data: studentsRes } = useQuery({ queryKey: ['students-all'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });
  const { data: classesRes } = useQuery({ queryKey: ['classes-all'], queryFn: () => classApi.getAll({ page: 1, limit: 100 }) });

  const templates = templatesRes?.data || [];
  const notesList = notesRes?.data || [];
  const students = studentsRes?.data || [];
  const classes = classesRes?.data || [];

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['notes'] }); qc.invalidateQueries({ queryKey: ['points'] }); };

  const noteBulk = useBulkSelection(notesList);
  const bulkStatusMut = useMutation({ mutationFn: ({ ids, status }: { ids: string[]; status: any }) => noteApi.bulkUpdateStatus(ids, status), onSuccess: () => { invalidate(); noteBulk.clear(); toast.success(t('common.statusUpdated')); } });
  const bulkDeleteMut2 = useMutation({ mutationFn: (ids: string[]) => noteApi.bulkDelete(ids), onSuccess: () => { invalidate(); noteBulk.clear(); toast.success(t('common.bulkDeleted')); } });

  const createMut = useMutation({
    mutationFn: (d: Omit<Note, 'id' | 'createdAt' | 'status'>[]) => noteApi.createBulk(d),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast.success(t('notes.noteAdded')); },
  });
  const bulkMut = useMutation({
    mutationFn: (d: Omit<Note, 'id' | 'createdAt' | 'status'>[]) => noteApi.createBulk(d),
    onSuccess: (res) => { invalidate(); setBulkOpen(false); toast.success(res.message); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => noteApi.delete(id),
    onSuccess: () => { invalidate(); setDeleteId(null); toast.success(t('notes.noteDeleted')); },
  });

  const getStudentName = (id: string) => { const s = students.find(x => x.id === id); return s ? `${s.firstname} ${s.lastname}` : id; };
  const getTemplateName = (id: string) => templates.find(t => t.id === id)?.title || id;
  const getTemplateType = (id: string) => templates.find(t => t.id === id)?.type;

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return students.slice(0, 20);
    const q = studentSearch.toLowerCase();
    return students.filter(s => `${s.firstname} ${s.lastname}`.toLowerCase().includes(q)).slice(0, 20);
  }, [students, studentSearch]);

  const openSingle = () => {
    setFormTemplateId(''); setFormStudentIds([]); setFormDate(today()); setFormDesc(''); setStudentSearch('');
    setDialogOpen(true);
  };

  const openBulk = () => {
    setBulkShared(true);
    setBulkSharedTemplateId('');
    setBulkSharedDate(today());
    setBulkRowCount(3);
    setBulkRows(Array.from({ length: 3 }, () => ({ templateId: '', studentIds: [], date: today(), description: '' })));
    setBulkOpen(true);
  };

  const generateBulkRows = () => {
    const count = Math.max(1, Math.min(50, bulkRowCount));
    setBulkRows(Array.from({ length: count }, () => ({ templateId: '', studentIds: [], date: today(), description: '' })));
  };

  const handleSubmit = () => {
    if (!formTemplateId) { toast.error(t('notes.selectNoteError')); return; }
    if (formStudentIds.length === 0) { toast.error(t('notes.selectStudentError')); return; }
    const items = formStudentIds.map(studentId => ({
      templateId: formTemplateId,
      studentId,
      date: formDate,
      description: formDesc || undefined,
    }));
    createMut.mutate(items);
  };

  const handleBulkSubmit = () => {
    const rows = bulkRows.flatMap(r => {
      const templateId = bulkShared ? bulkSharedTemplateId : r.templateId;
      const date = bulkShared ? bulkSharedDate : r.date;
      if (!templateId || r.studentIds.length === 0) return [];
      return r.studentIds.map(studentId => ({
        templateId,
        studentId,
        date,
        description: r.description || undefined,
      }));
    });
    if (!rows.length) { toast.error(t('notes.addValidRow')); return; }
    bulkMut.mutate(rows);
  };

  const toggleStudentInForm = (id: string) => {
    setFormStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleScanSingle = (ids: string[]) => { if (ids[0]) { setFormStudentIds([ids[0]]); setDialogOpen(true); } };
  const handleScanBulk = (ids: string[]) => {
    setBulkShared(true);
    setBulkSharedTemplateId('');
    setBulkSharedDate(today());
    setBulkRows(ids.map(id => ({ templateId: '', studentIds: [id], date: today(), description: '' })));
    setBulkRowCount(ids.length);
    setBulkOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('notes.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('notes.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AttendanceQRScanner mode="single" entityType="students" onScanned={handleScanSingle} label={t('notes.scanSingle')} />
          <AttendanceQRScanner mode="bulk" entityType="students" onScanned={handleScanBulk} label={t('notes.scanBulk')} />
          <Button variant="outline" onClick={openBulk}><ListPlus className="me-2 h-4 w-4" />{t('notes.bulkAdd')}</Button>
          <Button onClick={openSingle}><Plus className="me-2 h-4 w-4" />{t('notes.addNote')}</Button>
        </div>
      </div>

      <FilterBar showClear={!!(filter.studentId || filter.templateId || filter.dateFrom || filter.dateTo)} onClear={() => setFilter({})}>
        <div className="space-y-1">
          <Label className="text-xs">{t('common.student')}</Label>
          <Select value={filter.studentId || 'all'} onValueChange={v => setFilter(f => ({ ...f, studentId: v === 'all' ? undefined : v }))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('common.allStudents')}</SelectItem>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('notes.noteType')}</Label>
          <Select value={filter.templateId || 'all'} onValueChange={v => setFilter(f => ({ ...f, templateId: v === 'all' ? undefined : v }))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('common.all')}</SelectItem>{templates.map(tpl => <SelectItem key={tpl.id} value={tpl.id}>{tpl.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex flex-col"><Label className="text-xs">{t('common.dateFrom')}</Label><DatePickerField value={filter.dateFrom || ''} onChange={v => setFilter(f => ({ ...f, dateFrom: v || undefined }))} placeholder={t('common.from')} className="w-40" /></div>
        <div className="space-y-1 flex flex-col"><Label className="text-xs">{t('common.dateTo')}</Label><DatePickerField value={filter.dateTo || ''} onChange={v => setFilter(f => ({ ...f, dateTo: v || undefined }))} placeholder={t('common.to')} className="w-40" /></div>
      </FilterBar>

      <Card>
        <CardContent className="p-0">
          <BulkActionBar selectedCount={noteBulk.count} onApprove={() => bulkStatusMut.mutate({ ids: [...noteBulk.selectedIds], status: 'APPROVED' })} onRemoveApproval={() => bulkStatusMut.mutate({ ids: [...noteBulk.selectedIds], status: 'PENDING' })} onDelete={() => bulkDeleteMut2.mutate([...noteBulk.selectedIds])} />
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : notesList.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">{t('notes.noNotes')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={noteBulk.isAllSelected} onCheckedChange={() => noteBulk.toggleAll()} /></TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead>{t('common.student')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.description')}</TableHead>
                  <TableHead className="w-16">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notesList.map(n => (
                  <TableRow key={n.id}>
                    <TableCell><Checkbox checked={noteBulk.selectedIds.has(n.id)} onCheckedChange={() => noteBulk.toggle(n.id)} /></TableCell>
                    <TableCell>{n.date}</TableCell>
                    <TableCell>
                      <Badge variant={getTemplateType(n.templateId) === 'positive' ? 'default' : 'destructive'}>
                        {getTemplateName(n.templateId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getStudentName(n.studentId)}</Badge>
                    </TableCell>
                    <TableCell><ApprovalStatusBadge status={n.status} /></TableCell>
                    <TableCell className="max-w-48 truncate">{n.description || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('notes.addNote')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('notes.noteType')}</Label>
              <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                <SelectTrigger><SelectValue placeholder={t('notes.selectType')} /></SelectTrigger>
                <SelectContent>{templates.map(tpl => <SelectItem key={tpl.id} value={tpl.id}>{tpl.title} ({tpl.type === 'positive' ? t('common.positive') : t('common.negative')})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.students')}</Label>
              <Input placeholder={t('notes.searchStudents')} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                {filteredStudents.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm">
                    <input type="checkbox" checked={formStudentIds.includes(s.id)} onChange={() => toggleStudentInForm(s.id)} className="rounded" />
                    {s.firstname} {s.lastname}
                    <span className="text-muted-foreground text-xs ms-auto">{classes.find(c => c.id === s.classId)?.name || ''}</span>
                  </label>
                ))}
              </div>
              {formStudentIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {formStudentIds.map(id => (
                    <Badge key={id} variant="secondary" className="cursor-pointer" onClick={() => toggleStudentInForm(id)}>
                      {getStudentName(id)} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('common.date')}</Label>
              <DatePickerField value={formDate} onChange={setFormDate} />
            </div>
            <div className="space-y-2">
              <Label>{t('notes.descriptionOptional')}</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder={t('notes.addDescription')} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>{t('notes.addNote')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('notes.bulkAddNotes')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Row count */}
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">{t('common.numberOfRows')}</Label>
                <Input type="number" min={1} max={50} value={bulkRowCount} onChange={e => setBulkRowCount(Math.max(1, Number(e.target.value)))} className="w-24" />
              </div>
              <Button variant="outline" size="sm" onClick={generateBulkRows}>{t('common.generateRows')}</Button>
            </div>

            {/* Shared toggle */}
            <div className="flex items-center gap-2">
              <Switch checked={bulkShared} onCheckedChange={setBulkShared} />
              <Label className="text-sm">{t('common.sharedSettings')}</Label>
            </div>

            {/* Shared fields */}
            {bulkShared && (
              <div className="flex gap-3 flex-wrap p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1 flex-1 min-w-[150px]">
                  <Label className="text-xs">{t('notes.noteType')}</Label>
                  <Select value={bulkSharedTemplateId} onValueChange={setBulkSharedTemplateId}>
                    <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                    <SelectContent>{templates.map(tpl => <SelectItem key={tpl.id} value={tpl.id}>{tpl.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('common.date')}</Label>
                  <DatePickerField value={bulkSharedDate} onChange={setBulkSharedDate} className="w-40" />
                </div>
              </div>
            )}

            {/* Rows */}
            <div className="space-y-2">
              {bulkRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-end flex-wrap border-b border-border pb-2">
                  <div className="flex-1 min-w-[150px] space-y-1">
                    <Label className="text-xs">{t('common.student')}</Label>
                    <Select value={row.studentIds[0] || ''} onValueChange={v => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, studentIds: [v] } : r))}>
                      <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                      <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {!bulkShared && (
                    <>
                      <div className="flex-1 min-w-[150px] space-y-1">
                        <Label className="text-xs">{t('common.type')}</Label>
                        <Select value={row.templateId} onValueChange={v => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, templateId: v } : r))}>
                          <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                          <SelectContent>{templates.map(tpl => <SelectItem key={tpl.id} value={tpl.id}>{tpl.title}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('common.date')}</Label>
                        <DatePickerField value={row.date} onChange={v => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, date: v } : r))} className="w-36" />
                      </div>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setBulkRows(prev => prev.filter((_, i) => i !== idx))} disabled={bulkRows.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setBulkRows(prev => [...prev, { templateId: '', studentIds: [], date: today(), description: '' }])}>
                <Plus className="me-2 h-4 w-4" />{t('notes.addRow')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleBulkSubmit} disabled={bulkMut.isPending}>{t('notes.submitAll')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('notes.deleteNote')}</AlertDialogTitle>
            <AlertDialogDescription>{t('notes.deleteNoteDesc')}</AlertDialogDescription>
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
