import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { markRecordApi } from '@/services/mark-record-api';
import { studentApi, levelApi, classApi, subjectApi, teacherApi } from '@/services/api';
import type { MarkRecord, NonOfficialMarkRecord, OfficialMarkRecord } from '@/types/mark-record';
import { computeColumnValue, computeColumnMax, getInputColumns } from '@/lib/mark-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Pencil, Download, Upload, BarChart3, Grid3X3 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionBar, useBulkSelection } from '@/components/BulkActionBar';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { toast } from 'sonner';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { exportToExcel } from '@/lib/excel-utils';
import { DatePickerField } from '@/components/DatePickerField';
import type { Column } from '@/components/DataTable';
import { MarkStatisticsPanel } from '@/components/MarkStatisticsPanel';

export default function MarkRecords() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page] = useState(1);
  const [filterOfficial, setFilterOfficial] = useState<string>('all');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStudent, setFilterStudent] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [nonOfficialOpen, setNonOfficialOpen] = useState(false);
  const [officialOpen, setOfficialOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<MarkRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const isOfficialFilter = filterOfficial === 'all' ? null : filterOfficial === 'official';

  const { data: recordsRes, isLoading } = useQuery({
    queryKey: ['mark-records', page, filterOfficial, filterType, filterLevel, filterClass, filterSubject, filterStudent, filterDateFrom, filterDateTo],
    queryFn: () => markRecordApi.getAll({
      page, limit: 100,
      isOfficial: isOfficialFilter === null ? undefined : isOfficialFilter,
      typeId: filterType === 'all' ? undefined : filterType,
      levelId: filterLevel === 'all' ? undefined : filterLevel,
      classId: filterClass === 'all' ? undefined : filterClass,
      subjectId: filterSubject === 'all' ? undefined : filterSubject,
      studentId: filterStudent === 'all' ? undefined : filterStudent,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
    }),
  });
  const { data: settingsRes } = useQuery({ queryKey: ['mark-record-settings'], queryFn: () => markRecordApi.getSettings() });
  const { data: studentsRes } = useQuery({ queryKey: ['students'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });
  const { data: levelsRes } = useQuery({ queryKey: ['levels'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });
  const { data: classesRes } = useQuery({ queryKey: ['classes'], queryFn: () => classApi.getAll({ page: 1, limit: 100 }) });
  const { data: subjectsRes } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }) });
  const { data: teachersRes } = useQuery({ queryKey: ['teachers'], queryFn: () => teacherApi.getAll({ page: 1, limit: 100 }) });

  const deleteMut = useMutation({
    mutationFn: (id: string) => markRecordApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mark-records'] }); toast.success(t('marks.recordDeleted')); setDeleteId(null); },
  });

  const records = recordsRes?.data || [];
  const recordBulk = useBulkSelection(records);
  const bulkStatusMut = useMutation({ mutationFn: ({ ids, status }: { ids: string[]; status: any }) => markRecordApi.bulkUpdateStatus(ids, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['mark-records'] }); recordBulk.clear(); toast.success(t('common.statusUpdated')); } });
  const bulkDeleteMut2 = useMutation({ mutationFn: (ids: string[]) => markRecordApi.bulkDelete(ids), onSuccess: () => { qc.invalidateQueries({ queryKey: ['mark-records'] }); recordBulk.clear(); toast.success(t('common.bulkDeleted')); } });
  const types = settingsRes?.data?.types || [];
  const templates = settingsRes?.data?.officialTemplates || [];
  const students = studentsRes?.data || [];
  const levels = levelsRes?.data || [];
  const classes = classesRes?.data || [];
  const allSubjects = subjectsRes?.data || [];
  // All subjects visible in list filters; only NORMAL for entry dialogs
  const subjects = allSubjects;
  const normalSubjects = allSubjects.filter((s) => s.type !== 'MAIN');
  const teachers = teachersRes?.data || [];

  const getStudentName = (id: string) => { const s = students.find(x => x.id === id); return s ? `${s.firstname} ${s.lastname}` : id; };
  const getSubjectName = (id: string) => subjects.find(x => x.id === id)?.name || id;
  const getLevelName = (id: string) => levels.find(x => x.id === id)?.name || id;
  const getClassName = (id: string) => classes.find(x => x.id === id)?.name || id;
  const getTypeName = (id: string) => types.find(x => x.id === id)?.name || id;
  const getTemplateName = (id: string) => templates.find(x => x.id === id)?.name || id;

  const getScoreDisplay = (record: MarkRecord) => {
    if (!record.isOfficial) {
      const nr = record as NonOfficialMarkRecord;
      return `${nr.score}/${nr.maxScore}`;
    }
    const official = record as OfficialMarkRecord;
    const tpl = templates.find(t => t.id === official.templateId);
    if (!tpl) return '—';
    const inputs = getInputColumns(tpl);
    const total = inputs.reduce((a, c) => a + (official.scores[c.id] ?? 0), 0);
    const max = inputs.reduce((a, c) => a + c.maxScore, 0);
    return `${total}/${max}`;
  };

  const handleExport = () => {
    const cols: Column<MarkRecord>[] = [
      { key: 'id' as any, label: t('common.id') },
      { key: 'studentId' as any, label: t('common.student'), render: r => getStudentName(r.studentId) as any },
      { key: 'subjectId' as any, label: t('common.subject'), render: r => getSubjectName(r.subjectId) as any },
      { key: 'isOfficial' as any, label: t('common.type'), render: r => (r.isOfficial ? t('common.official') : getTypeName((r as NonOfficialMarkRecord).typeId)) as any },
      { key: 'date' as any, label: t('common.date') },
      { key: 'notes' as any, label: t('common.notes') },
    ];
    exportToExcel(records, cols, 'mark-records');
    toast.success(t('marks.exportedToExcel'));
  };

  const handleImport = (rows: Record<string, string>[]) => {
    const newRecords = rows.map(row => {
      const student = students.find(s => `${s.firstname} ${s.lastname}` === row['Student']);
      const subject = subjects.find(s => s.name === row['Subject']);
      return {
        studentId: student?.id || '',
        subjectId: subject?.id || '',
        levelId: student?.levelId || '',
        classId: student?.classId || '',
        typeId: types.find(t => t.name === row['Type'])?.id || types[0]?.id || '',
        score: Number(row['Score']) || 0,
        maxScore: Number(row['MaxScore']) || 100,
        date: row['Date'] || new Date().toISOString().split('T')[0],
        notes: row['Notes'] || '',
        isOfficial: false as const,
      };
    }).filter(r => r.studentId && r.subjectId);

    if (newRecords.length === 0) { toast.error(t('marks.noValidRecords')); return; }
    markRecordApi.bulkCreate(newRecords).then(() => {
      qc.invalidateQueries({ queryKey: ['mark-records'] });
      toast.success(t('marks.importedCount', { count: newRecords.length }));
    });
  };

  const handleEditClick = (record: MarkRecord) => {
    setEditRecord(record);
    if (record.isOfficial) {
      setOfficialOpen(true);
    } else {
      setNonOfficialOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('marks.title')}</h1>
          <p className="text-muted-foreground">{t('marks.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)}><BarChart3 className="mr-2 h-4 w-4" />{showStats ? t('marks.hideStats') : t('common.statistics')}</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4" />{t('common.export')}</Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />{t('common.import')}</Button>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}><Grid3X3 className="mr-2 h-4 w-4" />{t('marks.bulkOfficial')}</Button>
          <Button size="sm" variant="outline" onClick={() => { setEditRecord(null); setOfficialOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t('marks.addOfficial')}</Button>
          <Button size="sm" onClick={() => { setEditRecord(null); setNonOfficialOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t('marks.addNonOfficial')}</Button>
        </div>
      </div>

      {/* Statistics Panel */}
      {showStats && (
        <OfficialStatsPanel
          levels={levels}
          classes={classes}
          subjects={subjects}
          teachers={teachers}
        />
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              <Label className="text-xs">{t('common.level')}</Label>
              <Select value={filterLevel} onValueChange={v => { setFilterLevel(v); setFilterClass('all'); }}>
                <SelectTrigger><SelectValue placeholder={t('common.allLevels')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('common.class')}</Label>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger><SelectValue placeholder={t('common.allClasses')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {classes.filter(c => filterLevel === 'all' || c.levelId === filterLevel).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
              <Label className="text-xs">{t('common.student')}</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger><SelectValue placeholder={t('common.allStudents')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}
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
        </CardContent>
      </Card>

      {/* Table */}
      <BulkActionBar selectedCount={recordBulk.count} onApprove={() => bulkStatusMut.mutate({ ids: [...recordBulk.selectedIds], status: 'APPROVED' })} onRemoveApproval={() => bulkStatusMut.mutate({ ids: [...recordBulk.selectedIds], status: 'PENDING' })} onDelete={() => bulkDeleteMut2.mutate([...recordBulk.selectedIds])} />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={recordBulk.isAllSelected} onCheckedChange={() => recordBulk.toggleAll()} /></TableHead>
              <TableHead>{t('common.student')}</TableHead>
              <TableHead>{t('common.subject')}</TableHead>
              <TableHead>{t('common.category')}</TableHead>
              <TableHead>{t('common.typeTemplate')}</TableHead>
              <TableHead>{t('common.score')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('common.notes')}</TableHead>
              <TableHead className="w-24">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t('marks.noRecordsFound')}</TableCell></TableRow>
            ) : records.map(record => (
              <TableRow key={record.id}>
                <TableCell><Checkbox checked={recordBulk.selectedIds.has(record.id)} onCheckedChange={() => recordBulk.toggle(record.id)} /></TableCell>
                <TableCell className="font-medium">{getStudentName(record.studentId)}</TableCell>
                <TableCell>{getSubjectName(record.subjectId)}</TableCell>
                <TableCell>
                  <Badge variant={record.isOfficial ? 'default' : 'secondary'}>
                    {record.isOfficial ? t('common.official') : t('common.nonOfficial')}
                  </Badge>
                </TableCell>
                <TableCell>{record.isOfficial ? getTemplateName((record as OfficialMarkRecord).templateId) : getTypeName((record as NonOfficialMarkRecord).typeId)}</TableCell>
                <TableCell className="font-mono">{getScoreDisplay(record)}</TableCell>
                <TableCell><ApprovalStatusBadge status={record.status} /></TableCell>
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

      <NonOfficialFormDialog
        open={nonOfficialOpen}
        onOpenChange={setNonOfficialOpen}
        record={editRecord as NonOfficialMarkRecord | null}
        students={students}
        subjects={normalSubjects}
        levels={levels}
        classes={classes}
        types={types}
        onSaved={() => qc.invalidateQueries({ queryKey: ['mark-records'] })}
      />

      <OfficialFormDialog
        open={officialOpen}
        onOpenChange={setOfficialOpen}
        record={editRecord as OfficialMarkRecord | null}
        students={students}
        subjects={normalSubjects}
        levels={levels}
        classes={classes}
        templates={templates}
        onSaved={() => qc.invalidateQueries({ queryKey: ['mark-records'] })}
      />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('marks.deleteRecord')}</AlertDialogTitle><AlertDialogDescription>{t('marks.deleteRecordDesc')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        expectedColumns={['Student', 'Subject', 'Type', 'Score', 'MaxScore', 'Date', 'Notes']}
      />

      <BulkOfficialDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        levels={levels}
        classes={classes}
        subjects={normalSubjects}
        onStart={(levelId, classIds, subjectIds) => {
          setBulkOpen(false);
          const params = new URLSearchParams();
          if (levelId) params.set('levelId', levelId);
          if (classIds.length) params.set('classIds', classIds.join(','));
          if (subjectIds.length) params.set('subjectIds', subjectIds.join(','));
          navigate(`/mark-records/bulk?${params.toString()}`);
        }}
      />
    </div>
  );
}

// ─── Statistics Panel ────────────────────────────────────────────
function OfficialStatsPanel({ levels, classes, subjects, teachers }: { levels: any[]; classes: any[]; subjects: any[]; teachers: any[] }) {
  const { t } = useTranslation();
  return (
    <MarkStatisticsPanel
      showFilters={true}
      title={t('marks.officialStats')}
    />
  );
}

// ─── Non-Official Form ───────────────────────────────────────────
function NonOfficialFormDialog({ open, onOpenChange, record, students, subjects, levels, classes, types, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record: NonOfficialMarkRecord | null;
  students: any[];
  subjects: any[];
  levels: any[];
  classes: any[];
  types: any[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [levelId, setLevelId] = useState('');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
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
        setLevelId(record.levelId);
        setClassId(record.classId);
        setStudentId(record.studentId);
        setSubjectId(record.subjectId);
        setTypeId(record.typeId);
        setScore(record.score);
        setMaxScore(record.maxScore);
        setDate(record.date);
        setNotes(record.notes);
      } else {
        setLevelId(''); setClassId(''); setStudentId(''); setSubjectId('');
        setTypeId(''); setScore(0); setMaxScore(100); setDate(new Date().toISOString().split('T')[0]); setNotes('');
      }
    }
  }, [open, record]);

  const filteredStudents = students.filter(s => {
    if (classId) return s.classId === classId;
    if (levelId) return s.levelId === levelId;
    return true;
  });

  const createMut = useMutation({
    mutationFn: (data: any) => isEditing ? markRecordApi.update(record!.id, data) : markRecordApi.create(data),
    onSuccess: () => { onSaved(); onOpenChange(false); toast.success(isEditing ? t('marks.recordUpdated') : t('marks.recordCreated')); },
  });

  const handleSave = () => {
    if (!studentId || !subjectId || !typeId) { toast.error(t('marks.studentSubjectTypeRequired')); return; }
    if (score > maxScore) { toast.error(t('marks.scoreExceedsMaxDetail', { score, max: maxScore })); return; }
    if (score < 0) { toast.error(t('marks.scoreNegative')); return; }
    const student = students.find(s => s.id === studentId);
    const resolvedLevelId = levelId || student?.levelId || undefined;
    const resolvedClassId = classId || student?.classId || undefined;
    createMut.mutate({
      studentId, subjectId,
      ...(resolvedLevelId && { levelId: resolvedLevelId }),
      ...(resolvedClassId && { classId: resolvedClassId }),
      typeId, score, maxScore, date, notes, isOfficial: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditing ? t('marks.editNonOfficial') : t('marks.addNonOfficialRecord')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('common.level')}</Label>
              <Select value={levelId || 'none'} onValueChange={v => { setLevelId(v === 'none' ? '' : v); setClassId(''); setStudentId(''); }}>
                <SelectTrigger><SelectValue placeholder={t('common.selectLevel')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.allLevels')}</SelectItem>
                  {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.class')}</Label>
              <Select value={classId || 'none'} onValueChange={v => { setClassId(v === 'none' ? '' : v); setStudentId(''); }}>
                <SelectTrigger><SelectValue placeholder={t('common.selectClass')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.allClasses')}</SelectItem>
                  {classes.filter((c: any) => !levelId || c.levelId === levelId).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('common.student')} *</Label>
              <Select value={studentId || 'none'} onValueChange={v => setStudentId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('common.selectStudent')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.selectStudent')}</SelectItem>
                  {filteredStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.subject')} *</Label>
              <Select value={subjectId || 'none'} onValueChange={v => setSubjectId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('marks.selectSubject')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('marks.selectSubject')}</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('common.type')} *</Label>
            <Select value={typeId || 'none'} onValueChange={v => setTypeId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder={t('marks.selectType')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('marks.selectType')}</SelectItem>
                {types.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t('common.score')}</Label>
              <Input type="number" value={score} onChange={e => setScore(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>{t('common.maxScore')}</Label>
              <Input type="number" value={maxScore} onChange={e => setMaxScore(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>{t('common.date')}</Label>
              <DatePickerField value={date} onChange={setDate} placeholder={t('marks.pickDate')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('common.notes')}</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('marks.optionalNotes')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={createMut.isPending}>{isEditing ? t('common.update') : t('common.create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Official Form ───────────────────────────────────────────────
function OfficialFormDialog({ open, onOpenChange, record, students, subjects, levels, classes, templates, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record: OfficialMarkRecord | null;
  students: any[];
  subjects: any[];
  levels: any[];
  classes: any[];
  templates: any[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [levelId, setLevelId] = useState('');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    if (open) {
      if (record && record.isOfficial) {
        setLevelId(record.levelId);
        setClassId(record.classId);
        setStudentId(record.studentId);
        setSubjectId(record.subjectId);
        setScores({ ...record.scores });
        setDate(record.date);
        setNotes(record.notes);
        setExistingId(record.id);
      } else {
        setLevelId(''); setClassId(''); setStudentId(''); setSubjectId('');
        setScores({}); setDate(new Date().toISOString().split('T')[0]); setNotes(''); setExistingId(null);
      }
    }
  }, [open, record]);

  useEffect(() => {
    if (studentId && subjectId && open && !(record?.isOfficial)) {
      setLoadingExisting(true);
      markRecordApi.findOfficialRecord(studentId, subjectId).then(res => {
        if (res.data) {
          setScores({ ...res.data.scores });
          setDate(res.data.date);
          setNotes(res.data.notes);
          setExistingId(res.data.id);
        } else {
          setScores({});
          setExistingId(null);
        }
        setLoadingExisting(false);
      });
    }
  }, [studentId, subjectId]);

  const template = templates.find((t: any) => t.levelId === levelId);

  const filteredStudents = students.filter(s => {
    if (classId) return s.classId === classId;
    if (levelId) return s.levelId === levelId;
    return true;
  });

  const upsertMut = useMutation({
    mutationFn: (data: any) => markRecordApi.upsertOfficial(data),
    onSuccess: () => { onSaved(); onOpenChange(false); toast.success(existingId ? t('marks.officialRecordUpdated') : t('marks.officialRecordCreated')); },
  });

  const handleSave = () => {
    if (!studentId || !subjectId) { toast.error(t('marks.studentSubjectRequired')); return; }
    if (!template) { toast.error(t('marks.noTemplateForLevel')); return; }
    const inputCols = getInputColumns(template);
    for (const col of inputCols) {
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
    // strip computed column ids before saving
    const cleanScores: Record<string, number> = {};
    const inputIds = new Set(inputCols.map(c => c.id));
    for (const [k, v] of Object.entries(scores)) {
      if (inputIds.has(k)) cleanScores[k] = v;
    }
    const student = students.find(s => s.id === studentId);
    const resolvedLevelId = levelId || student?.levelId || undefined;
    const resolvedClassId = classId || student?.classId || undefined;
    upsertMut.mutate({
      studentId, subjectId,
      ...(resolvedLevelId && { levelId: resolvedLevelId }),
      ...(resolvedClassId && { classId: resolvedClassId }),
      templateId: template.id,
      scores: cleanScores, date, notes, isOfficial: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('marks.officialMarkRecord')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('common.level')} *</Label>
              <Select value={levelId || 'none'} onValueChange={v => { setLevelId(v === 'none' ? '' : v); setClassId(''); setStudentId(''); setScores({}); setExistingId(null); }}>
                <SelectTrigger><SelectValue placeholder={t('common.selectLevel')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.selectLevel')}</SelectItem>
                  {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.class')}</Label>
              <Select value={classId || 'none'} onValueChange={v => { setClassId(v === 'none' ? '' : v); setStudentId(''); }}>
                <SelectTrigger><SelectValue placeholder={t('common.selectClass')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.allClasses')}</SelectItem>
                  {classes.filter((c: any) => !levelId || c.levelId === levelId).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('common.student')} *</Label>
              <Select value={studentId || 'none'} onValueChange={v => setStudentId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('common.selectStudent')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.selectStudent')}</SelectItem>
                  {filteredStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.subject')} *</Label>
              <Select value={subjectId || 'none'} onValueChange={v => setSubjectId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('marks.selectSubject')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('marks.selectSubject')}</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {levelId && !template && (
            <p className="text-sm text-destructive">{t('marks.noTemplateConfigured')}</p>
          )}

          {existingId && (
            <Badge variant="outline" className="text-xs">{t('marks.editingExisting')}</Badge>
          )}

          {template && studentId && subjectId && (
            <div className="space-y-2">
              <Label>{template.name}</Label>
              {loadingExisting ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  {template.columns.sort((a: any, b: any) => a.order - b.order).map((col: any) => {
                    const isComputed = col.kind === 'computed';
                    const computedVal = isComputed ? computeColumnValue(col, scores) : undefined;
                    const derivedMax = isComputed ? computeColumnMax(col, template.columns) : col.maxScore;
                    return (
                      <div key={col.id} className="flex items-center gap-3">
                        <span className="text-sm flex-1">
                          {col.name}{' '}
                          <span className="text-muted-foreground">({t('common.max')}: {derivedMax})</span>
                          {isComputed && <span className="ms-1 text-xs text-blue-500">{t('marks.computed')}</span>}
                        </span>
                        {isComputed ? (
                          <div className="w-24 h-9 flex items-center justify-end rounded-md border bg-muted px-3 font-mono text-sm text-muted-foreground">
                            {computedVal !== undefined ? computedVal : '—'}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            className="w-24"
                            min={0}
                            max={col.maxScore}
                            value={scores[col.id] ?? ''}
                            onChange={e => setScores(prev => ({ ...prev, [col.id]: Number(e.target.value) }))}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('common.date')}</Label>
              <DatePickerField value={date} onChange={setDate} placeholder={t('marks.pickDate')} />
            </div>
            <div className="space-y-2">
              <Label>{t('common.notes')}</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('marks.optionalNotes')} />
            </div>
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

// ─── Bulk Official Dialog ────────────────────────────────────────
function BulkOfficialDialog({ open, onOpenChange, levels, classes, subjects, onStart }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  levels: any[];
  classes: any[];
  subjects: any[];
  onStart: (levelId: string, classIds: string[], subjectIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const [levelId, setLevelId] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (open) { setLevelId(''); setSelectedClasses([]); setSelectedSubjects([]); }
  }, [open]);

  const filteredClasses = classes.filter((c: any) => !levelId || c.levelId === levelId);
  const filteredSubjects = levelId
    ? subjects.filter((s: any) => {
        const level = levels.find((l: any) => l.id === levelId);
        return level?.subjectIds?.includes(s.id);
      })
    : subjects;

  const toggleClass = (id: string) => {
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('marks.bulkOfficialMarks')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('common.level')}</Label>
            <Select value={levelId || 'none'} onValueChange={v => { setLevelId(v === 'none' ? '' : v); setSelectedClasses([]); setSelectedSubjects([]); }}>
              <SelectTrigger><SelectValue placeholder={t('common.selectLevel')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('common.selectLevel')}</SelectItem>
                {levels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('marks.classesMultiSelect')}</Label>
            {!levelId ? (
              <p className="text-xs text-muted-foreground border rounded-md p-3">{t('marks.selectLevelFirst')}</p>
            ) : (
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {filteredClasses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('marks.noClassesAvailable')}</p>
                ) : filteredClasses.map((c: any) => (
                  <label key={c.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={selectedClasses.includes(c.id)} onCheckedChange={() => toggleClass(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
            {selectedClasses.length > 0 && (
              <p className="text-xs text-muted-foreground">{t('marks.selectedCount', { count: selectedClasses.length })}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('marks.subjectsMultiSelect')}</Label>
            {!levelId ? (
              <p className="text-xs text-muted-foreground border rounded-md p-3">{t('marks.selectLevelFirstSubjects')}</p>
            ) : (
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {filteredSubjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('marks.noSubjectsAvailable')}</p>
                ) : filteredSubjects.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={selectedSubjects.includes(s.id)} onCheckedChange={() => toggleSubject(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
            {selectedSubjects.length > 0 && (
              <p className="text-xs text-muted-foreground">{t('marks.selectedCount', { count: selectedSubjects.length })}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedClasses.length > 0 && selectedSubjects.length > 0
              ? t('marks.autoFillHint')
              : t('marks.manualHint')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => onStart(levelId, selectedClasses, selectedSubjects)}>{t('marks.start')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
