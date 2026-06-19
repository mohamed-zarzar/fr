import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { markRecordApi } from '@/services/mark-record-api';
import { subjectApi } from '@/services/api';
import type { NonOfficialMarkRecord, OfficialMarkRecord, MarkRecord } from '@/types/mark-record';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DatePickerField } from '@/components/DatePickerField';
import { useTranslation } from 'react-i18next';

interface Props {
  studentId: string;
  studentName: string;
  studentLevelId?: string;
  studentClassId?: string;
}

export function StudentMarkRecordsTab({ studentId, studentName, studentLevelId, studentClassId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filterOfficial, setFilterOfficial] = useState<string>('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [addNonOfficialOpen, setAddNonOfficialOpen] = useState(false);
  const [addOfficialOpen, setAddOfficialOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<MarkRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isOfficialFilter = filterOfficial === 'all' ? null : filterOfficial === 'official';

  const { data: recordsRes, isLoading } = useQuery({
    queryKey: ['mark-records', 'student', studentId, filterOfficial, filterType, filterSubject, filterDateFrom, filterDateTo],
    queryFn: () => markRecordApi.getAll({
      page: 1, limit: 100, studentId,
      isOfficial: isOfficialFilter === null ? undefined : isOfficialFilter,
      typeId: filterType === 'all' ? undefined : filterType,
      subjectId: filterSubject === 'all' ? undefined : filterSubject,

      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
    }),
  });
  const { data: settingsRes } = useQuery({ queryKey: ['mark-record-settings'], queryFn: () => markRecordApi.getSettings() });
  const { data: subjectsRes } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }) });

  const deleteMut = useMutation({
    mutationFn: (id: string) => markRecordApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mark-records'] }); toast.success(t('marks.recordDeleted')); setDeleteId(null); },
  });

  const records = recordsRes?.data || [];
  const types = settingsRes?.data?.types || [];
  const templates = settingsRes?.data?.officialTemplates || [];
  const subjects = subjectsRes?.data || [];

  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || id;
  const getTypeName = (id: string) => types.find(t => t.id === id)?.name || id;
  const getTemplateName = (id: string) => templates.find(t => t.id === id)?.name || id;

  const getScoreDisplay = (record: MarkRecord) => {
    if (!record.isOfficial) {
      const nr = record as NonOfficialMarkRecord;
      return `${nr.score}/${nr.maxScore}`;
    }
    const official = record as OfficialMarkRecord;
    const tpl = templates.find(t => t.id === official.templateId);
    if (!tpl) return '—';
    const total = Object.values(official.scores).reduce((a, b) => a + b, 0);
    const max = tpl.columns.reduce((a, c) => a + c.maxScore, 0);
    return `${total}/${max}`;
  };

  const handleEditClick = (record: MarkRecord) => {
    setEditRecord(record);
    if (record.isOfficial) {
      setAddOfficialOpen(true);
    } else {
      setAddNonOfficialOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">
          <div className="space-y-1">
            <Label className="text-xs">{t('common.category')}</Label>
            <Select value={filterOfficial} onValueChange={setFilterOfficial}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="official">{t('common.official')}</SelectItem>
                <SelectItem value="non-official">{t('common.nonOfficial')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filterOfficial !== 'official' && (
            <div className="space-y-1">
              <Label className="text-xs">{t('common.type')}</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger><SelectValue placeholder={t('common.allTypes')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">{t('common.subject')}</Label>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger><SelectValue placeholder={t('common.allSubjects')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('common.dateFrom')}</Label>
            <DatePickerField value={filterDateFrom} onChange={setFilterDateFrom} placeholder={t('common.dateFrom')} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('common.dateTo')}</Label>
            <DatePickerField value={filterDateTo} onChange={setFilterDateTo} placeholder={t('common.dateTo')} />
          </div>
        </div>
        <div className="flex gap-2 self-end">
          <Button size="sm" variant="outline" onClick={() => { setEditRecord(null); setAddOfficialOpen(true); }}>
            <Plus className="me-1 h-4 w-4" />{t('marks.addOfficial')}
          </Button>
          <Button size="sm" onClick={() => { setEditRecord(null); setAddNonOfficialOpen(true); }}>
            <Plus className="me-1 h-4 w-4" />{t('marks.addNonOfficial')}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.subject')}</TableHead>
              <TableHead>{t('common.category')}</TableHead>
              <TableHead>{t('common.typeTemplate')}</TableHead>
              <TableHead>{t('common.score')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('common.notes')}</TableHead>
              <TableHead className="w-24">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('marks.noRecordsFound')}</TableCell></TableRow>
            ) : records.map(record => (
              <TableRow key={record.id}>
                <TableCell>{getSubjectName(record.subjectId)}</TableCell>
                <TableCell>
                  <Badge variant={record.isOfficial ? 'default' : 'secondary'}>
                    {record.isOfficial ? t('common.official') : t('common.nonOfficial')}
                  </Badge>
                </TableCell>
                <TableCell>{record.isOfficial ? getTemplateName((record as OfficialMarkRecord).templateId) : getTypeName((record as NonOfficialMarkRecord).typeId)}</TableCell>
                <TableCell className="font-mono">{getScoreDisplay(record)}</TableCell>
                <TableCell>{record.date}</TableCell>
                <TableCell className="max-w-32 truncate">{record.notes}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(record)}><Pencil className="h-4 w-4" /></Button>
                    {!record.isOfficial && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(record.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <StudentNonOfficialDialog
        open={addNonOfficialOpen}
        onOpenChange={setAddNonOfficialOpen}
        record={editRecord as NonOfficialMarkRecord | null}
        studentId={studentId}
        studentLevelId={studentLevelId}
        studentClassId={studentClassId}
        subjects={subjects}
        types={types}
        onSaved={() => qc.invalidateQueries({ queryKey: ['mark-records'] })}
      />

      <StudentOfficialDialog
        open={addOfficialOpen}
        onOpenChange={setAddOfficialOpen}
        record={editRecord as OfficialMarkRecord | null}
        studentId={studentId}
        studentLevelId={studentLevelId}
        studentClassId={studentClassId}
        subjects={subjects}
        templates={templates}
        onSaved={() => qc.invalidateQueries({ queryKey: ['mark-records'] })}
      />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('marks.deleteRecord')}</AlertDialogTitle><AlertDialogDescription>{t('marks.deleteRecordDesc')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Student Non-Official Dialog ─────────────────────────────────
function StudentNonOfficialDialog({ open, onOpenChange, record, studentId, studentLevelId, studentClassId, subjects, types, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  record: NonOfficialMarkRecord | null;
  studentId: string; studentLevelId?: string; studentClassId?: string;
  subjects: any[]; types: any[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [subjectId, setSubjectId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const isEditing = !!record && !record.isOfficial;

  useEffect(() => {
    if (open) {
      if (record && !record.isOfficial) {
        setSubjectId(record.subjectId); setTypeId(record.typeId);
        setScore(record.score); setMaxScore(record.maxScore); setDate(record.date); setNotes(record.notes);
      } else {
        setSubjectId(''); setTypeId(''); setScore(0); setMaxScore(100);
        setDate(new Date().toISOString().split('T')[0]); setNotes('');
      }
    }
  }, [open, record]);

  const mut = useMutation({
    mutationFn: (data: any) => isEditing ? markRecordApi.update(record!.id, data) : markRecordApi.create(data),
    onSuccess: () => { onSaved(); onOpenChange(false); toast.success(isEditing ? t('attendance.updated') : t('common.created')); },
  });

  const handleSave = () => {
    if (!subjectId || !typeId) { toast.error(t('marks.subjectTypeRequired')); return; }
    if (score > maxScore) { toast.error(t('marks.scoreExceedsMax')); return; }
    if (score < 0) { toast.error(t('marks.scoreNegative')); return; }
    mut.mutate({
      studentId,
      subjectId,
      levelId: studentLevelId!,
      ...(studentClassId ? { classId: studentClassId } : {}),
      typeId,
      score,
      maxScore,
      date,
      notes,
      isOfficial: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEditing ? t('marks.editNonOfficial') : t('marks.addNonOfficialRecord')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('common.subject')} *</Label>
              <Select value={subjectId || 'none'} onValueChange={v => setSubjectId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('common.subject')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.subject')}</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.type')} *</Label>
              <Select value={typeId || 'none'} onValueChange={v => setTypeId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('common.type')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.type')}</SelectItem>
                  {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>{t('common.score')}</Label><Input type="number" value={score} onChange={e => setScore(Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>{t('common.maxScore')}</Label><Input type="number" value={maxScore} onChange={e => setMaxScore(Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>{t('common.date')}</Label><DatePickerField value={date} onChange={setDate} /></div>
          </div>
          <div className="space-y-2"><Label>{t('common.notes')}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={mut.isPending}>{isEditing ? t('common.update') : t('common.create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Student Official Dialog ─────────────────────────────────────
function StudentOfficialDialog({ open, onOpenChange, record, studentId, studentLevelId, studentClassId, subjects, templates, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  record: OfficialMarkRecord | null;
  studentId: string; studentLevelId?: string; studentClassId?: string;
  subjects: any[]; templates: any[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [subjectId, setSubjectId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const template = templates.find((t: any) => t.levelId === studentLevelId);

  useEffect(() => {
    if (open) {
      if (record && record.isOfficial) {
        setSubjectId(record.subjectId);
        setScores({ ...record.scores });
        setDate(record.date); setNotes(record.notes);
        setExistingId(record.id);
      } else {
        setSubjectId(''); setScores({}); setDate(new Date().toISOString().split('T')[0]); setNotes(''); setExistingId(null);
      }
    }
  }, [open, record]);

  useEffect(() => {
    if (subjectId && open && !(record?.isOfficial)) {
      setLoadingExisting(true);
      markRecordApi.findOfficialRecord(studentId, subjectId).then(res => {
        if (res.data) {
          setScores({ ...res.data.scores }); setDate(res.data.date); setNotes(res.data.notes); setExistingId(res.data.id);
        } else {
          setScores({}); setExistingId(null);
        }
        setLoadingExisting(false);
      });
    }
  }, [subjectId]);

  const upsertMut = useMutation({
    mutationFn: (data: any) => markRecordApi.upsertOfficial(data),
    onSuccess: () => { onSaved(); onOpenChange(false); toast.success(existingId ? t('attendance.updated') : t('common.created')); },
  });

  const handleSave = () => {
    if (!subjectId) { toast.error(t('marks.subjectRequired')); return; }
    if (!template) { toast.error(t('marks.noTemplateForLevel')); return; }
    for (const col of template.columns) {
      const val = scores[col.id];
      if (val !== undefined && val > col.maxScore) {
        toast.error(t('marks.columnScoreExceedsMax', { name: col.name, val, max: col.maxScore }));
        return;
      }
      if (val !== undefined && val < 0) {
        toast.error(t('marks.columnScoreNegative', { name: col.name }));
        return;
      }
    }
    upsertMut.mutate({
      studentId,
      subjectId,
      levelId: studentLevelId!,
      ...(studentClassId ? { classId: studentClassId } : {}),
      templateId: template.id,
      scores,
      date,
      notes,
      isOfficial: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('marks.officialMarkRecord')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('common.subject')} *</Label>
            <Select value={subjectId || 'none'} onValueChange={v => setSubjectId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder={t('common.subject')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('common.subject')}</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!template && (
            <p className="text-sm text-destructive">{t('marks.noTemplateForLevel')}</p>
          )}

          {existingId && <Badge variant="outline" className="text-xs">{t('marks.editingExisting')}</Badge>}

          {template && subjectId && (
            <div className="space-y-2">
              <Label>{template.name}</Label>
              {loadingExisting ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  {template.columns.sort((a: any, b: any) => a.order - b.order).map((col: any) => (
                    <div key={col.id} className="flex items-center gap-3">
                      <span className="text-sm flex-1">{col.name} <span className="text-muted-foreground">({t('common.max')}: {col.maxScore})</span></span>
                      <Input type="number" className="w-24" min={0} max={col.maxScore} value={scores[col.id] ?? ''} onChange={e => setScores(prev => ({ ...prev, [col.id]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('common.date')}</Label><DatePickerField value={date} onChange={setDate} /></div>
            <div className="space-y-2"><Label>{t('common.notes')}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={upsertMut.isPending}>{existingId ? t('common.update') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
