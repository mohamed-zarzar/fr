import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, Download, Upload, UserX, Clock, BarChart3, ListPlus, ScanLine } from 'lucide-react';
import { AttendanceCalendarView } from '@/components/AttendanceCalendarView';
import { ViewToggle } from '@/components/ViewToggle';
import { BulkActionBar, useBulkSelection } from '@/components/BulkActionBar';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { Pagination } from '@/components/DataTable';
import { toast } from 'sonner';
import { studentAttendanceApi } from '@/services/attendance-api';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { AttendanceQRScanner } from '@/components/AttendanceQRScanner';
import { DatePickerField } from '@/components/DatePickerField';
import { StudentSelect } from '@/components/selects/StudentSelect';
import { LevelSelect } from '@/components/selects/LevelSelect';
import { ClassSelect } from '@/components/selects/ClassSelect';
import { useTranslation } from 'react-i18next';
import type { StudentAbsence, StudentLate, AttendanceFilter } from '@/types/attendance';

const today = () => new Date().toISOString().split('T')[0];
const PAGE_LIMIT = 10;

export default function StudentAttendance() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'absences' | 'lates' | 'stats'>('absences');
  const [filter, setFilter] = useState<AttendanceFilter>({});
  const [absPage, setAbsPage] = useState(1);
  const [latePage, setLatePage] = useState(1);
  const [absDialog, setAbsDialog] = useState(false);
  const [lateDialog, setLateDialog] = useState(false);
  const [bulkAbsDialog, setBulkAbsDialog] = useState(false);
  const [bulkLateDialog, setBulkLateDialog] = useState(false);
  const [importAbsOpen, setImportAbsOpen] = useState(false);
  const [importLateOpen, setImportLateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'absence' | 'late' } | null>(null);
  const [editingAbsence, setEditingAbsence] = useState<StudentAbsence | null>(null);
  const [editingLate, setEditingLate] = useState<StudentLate | null>(null);
  const [absView, setAbsView] = useState<'table' | 'calendar'>('table');
  const [lateView, setLateView] = useState<'table' | 'calendar'>('table');

  const [formStudentId, setFormStudentId] = useState('');
  const [formDate, setFormDate] = useState(today());
  const [formJustified, setFormJustified] = useState(false);
  const [formReason, setFormReason] = useState('');
  const [formPeriod, setFormPeriod] = useState(10);

  const [bulkRowCount, setBulkRowCount] = useState(3);
  const [bulkShared, setBulkShared] = useState(true);
  const [bulkSharedDate, setBulkSharedDate] = useState(today());
  const [bulkRows, setBulkRows] = useState<{ studentId: string; date: string; isJustified: boolean; reason?: string; period?: number }[]>([{ studentId: '', date: today(), isJustified: false, period: 10 }]);

  const absFilter: AttendanceFilter = { ...filter, page: absPage, limit: PAGE_LIMIT };
  const lateFilter: AttendanceFilter = { ...filter, page: latePage, limit: PAGE_LIMIT };

  const { data: absencesRes, isLoading: absLoading } = useQuery({ queryKey: ['student-absences', absFilter], queryFn: () => studentAttendanceApi.getAbsences(absFilter) });
  const { data: latesRes, isLoading: lateLoading } = useQuery({ queryKey: ['student-lates', lateFilter], queryFn: () => studentAttendanceApi.getLates(lateFilter) });
  const { data: statsRes } = useQuery({ queryKey: ['student-attendance-stats', filter], queryFn: () => studentAttendanceApi.getStats(filter) });

  const absences = absencesRes?.data || [];
  const lates = latesRes?.data || [];
  const stats = statsRes?.data;

  const absBulk = useBulkSelection(absences);
  const lateBulk = useBulkSelection(lates);

  const bulkAbsStatusMut = useMutation({ mutationFn: ({ ids, status }: { ids: string[]; status: any }) => studentAttendanceApi.bulkUpdateAbsenceStatus(ids, status), onSuccess: () => { invalidate(); absBulk.clear(); toast.success(t('common.statusUpdated')); } });
  const bulkAbsDeleteMut = useMutation({ mutationFn: (ids: string[]) => studentAttendanceApi.bulkDeleteAbsences(ids), onSuccess: () => { invalidate(); absBulk.clear(); toast.success(t('common.bulkDeleted')); } });
  const bulkLateStatusMut = useMutation({ mutationFn: ({ ids, status }: { ids: string[]; status: any }) => studentAttendanceApi.bulkUpdateLateStatus(ids, status), onSuccess: () => { invalidate(); lateBulk.clear(); toast.success(t('common.statusUpdated')); } });
  const bulkLateDeleteMut = useMutation({ mutationFn: (ids: string[]) => studentAttendanceApi.bulkDeleteLates(ids), onSuccess: () => { invalidate(); lateBulk.clear(); toast.success(t('common.bulkDeleted')); } });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['student-absences'] }); qc.invalidateQueries({ queryKey: ['student-lates'] }); qc.invalidateQueries({ queryKey: ['student-attendance-stats'] }); };

  const createAbsMut = useMutation({
    mutationFn: (d: Omit<StudentAbsence, 'id' | 'createdAt'>) => studentAttendanceApi.createAbsence(d),
    onSuccess: (res) => { if (!res.success) { toast.error(res.message); return; } invalidate(); setAbsDialog(false); toast.success(t('attendance.absenceAdded')); },
  });
  const updateAbsMut = useMutation({ mutationFn: ({ id, ...d }: { id: string } & Partial<StudentAbsence>) => studentAttendanceApi.updateAbsence(id, d), onSuccess: () => { invalidate(); setEditingAbsence(null); toast.success(t('attendance.updated')); } });
  const deleteAbsMut = useMutation({ mutationFn: (id: string) => studentAttendanceApi.deleteAbsence(id), onSuccess: () => { invalidate(); toast.success(t('attendance.deleted')); } });
  const bulkAbsMut = useMutation({
    mutationFn: (d: Omit<StudentAbsence, 'id' | 'createdAt'>[]) => studentAttendanceApi.createAbsenceBulk(d),
    onSuccess: (res) => { invalidate(); setBulkAbsDialog(false); toast.success(res.message); },
  });

  const createLateMut = useMutation({
    mutationFn: (d: Omit<StudentLate, 'id' | 'createdAt'>) => studentAttendanceApi.createLate(d),
    onSuccess: (res) => { if (!res.success) { toast.error(res.message); return; } invalidate(); setLateDialog(false); toast.success(t('attendance.lateAdded')); },
  });
  const updateLateMut = useMutation({ mutationFn: ({ id, ...d }: { id: string } & Partial<StudentLate>) => studentAttendanceApi.updateLate(id, d), onSuccess: () => { invalidate(); setEditingLate(null); toast.success(t('attendance.updated')); } });
  const deleteLateMut = useMutation({ mutationFn: (id: string) => studentAttendanceApi.deleteLate(id), onSuccess: () => { invalidate(); toast.success(t('attendance.deleted')); } });
  const bulkLateMut = useMutation({
    mutationFn: (d: Omit<StudentLate, 'id' | 'createdAt'>[]) => studentAttendanceApi.createLateBulk(d),
    onSuccess: (res) => { invalidate(); setBulkLateDialog(false); toast.success(res.message); },
  });

  const getStudentName = (a: StudentAbsence | StudentLate) =>
    a.firstName ? `${a.firstName} ${a.lastName ?? ''}`.trim() : a.studentId;

  const resetAbsForm = (a?: StudentAbsence) => {
    setFormStudentId(a?.studentId || '');
    setFormDate(a?.date || today());
    setFormJustified(a?.isJustified || false);
    setFormReason(a?.reason || '');
  };
  const resetLateForm = (l?: StudentLate) => {
    setFormStudentId(l?.studentId || '');
    setFormDate(l?.date || today());
    setFormJustified(l?.isJustified || false);
    setFormReason(l?.reason || '');
    setFormPeriod(l?.period || 10);
  };

  const handleAbsSubmit = () => {
    if (!formStudentId) { toast.error(t('common.selectStudent')); return; }
    const data = { studentId: formStudentId, date: formDate, isJustified: formJustified, reason: formJustified ? formReason : undefined };
    if (editingAbsence) updateAbsMut.mutate({ id: editingAbsence.id, ...data });
    else createAbsMut.mutate(data);
  };

  const handleLateSubmit = () => {
    if (!formStudentId) { toast.error(t('common.selectStudent')); return; }
    const data = { studentId: formStudentId, date: formDate, isJustified: formJustified, reason: formJustified ? formReason : undefined, period: formPeriod };
    if (editingLate) updateLateMut.mutate({ id: editingLate.id, ...data });
    else createLateMut.mutate(data);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'absence') deleteAbsMut.mutate(deleteTarget.id);
    else deleteLateMut.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleScanSingleAbs = (ids: string[]) => { if (ids[0]) { resetAbsForm(); setFormStudentId(ids[0]); setAbsDialog(true); } };
  const handleScanSingleLate = (ids: string[]) => { if (ids[0]) { resetLateForm(); setFormStudentId(ids[0]); setLateDialog(true); } };
  const handleScanBulkAbs = (ids: string[]) => { setBulkRows(ids.map(id => ({ studentId: id, date: today(), isJustified: false }))); setBulkAbsDialog(true); };
  const handleScanBulkLate = (ids: string[]) => { setBulkRows(ids.map(id => ({ studentId: id, date: today(), isJustified: false, period: 10 }))); setBulkLateDialog(true); };

  const handleImportAbsences = async (file: File) => {
    const res = await studentAttendanceApi.importExcel(file);
    if (res.success) { invalidate(); toast.success(`${res.data?.imported ?? 0} records imported`); }
    else toast.error(res.message);
  };

  const handleImportLates = async (file: File) => {
    const res = await studentAttendanceApi.importExcel(file);
    if (res.success) { invalidate(); toast.success(`${res.data?.imported ?? 0} records imported`); }
    else toast.error(res.message);
  };

  const addBulkRow = () => setBulkRows(prev => [...prev, { studentId: '', date: today(), isJustified: false, period: 10 }]);
  const removeBulkRow = (idx: number) => setBulkRows(prev => prev.filter((_, i) => i !== idx));
  const updateBulkRow = (idx: number, field: string, value: any) => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  const generateBulkRows = () => {
    const count = Math.max(1, Math.min(50, bulkRowCount));
    setBulkRows(Array.from({ length: count }, () => ({ studentId: '', date: today(), isJustified: false, period: 10 })));
  };

  const handleFilterChange = (update: Partial<AttendanceFilter>) => {
    setFilter(f => ({ ...f, ...update }));
    setAbsPage(1);
    setLatePage(1);
  };

  const activeView = tab === 'absences' ? absView : lateView;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('attendance.studentAttendance')}</h1>
          <p className="text-sm text-muted-foreground">{t('attendance.trackAbsencesLates')}</p>
        </div>
      </div>

      <FilterBar showClear={!!(filter.entityId || filter.dateFrom || filter.dateTo || filter.levelId || filter.classId)} onClear={() => { setFilter({}); setAbsPage(1); setLatePage(1); }}>
        <div className="space-y-1">
          <Label className="text-xs">{t('common.student')}</Label>
          <StudentSelect
            value={filter.entityId || 'all'}
            onChange={v => handleFilterChange({ entityId: v === 'all' ? undefined : v })}
            levelId={filter.levelId}
            classId={filter.classId}
            allOption={{ value: 'all', label: t('common.allStudents') }}
            className="w-44"
          />
        </div>
        {activeView !== 'calendar' && (
          <>
            <div className="space-y-1 flex flex-col"><Label className="text-xs">{t('common.dateFrom')}</Label><DatePickerField value={filter.dateFrom || ''} onChange={v => handleFilterChange({ dateFrom: v || undefined })} placeholder={t('common.dateFrom')} className="w-40" /></div>
            <div className="space-y-1 flex flex-col"><Label className="text-xs">{t('common.dateTo')}</Label><DatePickerField value={filter.dateTo || ''} onChange={v => handleFilterChange({ dateTo: v || undefined })} placeholder={t('common.dateTo')} className="w-40" /></div>
          </>
        )}
        <div className="space-y-1">
          <Label className="text-xs">{t('common.level')}</Label>
          <LevelSelect value={filter.levelId || 'all'} onChange={v => handleFilterChange({ levelId: v === 'all' ? undefined : v })} allOption={{ value: 'all', label: t('common.allLevels') }} className="w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('common.class')}</Label>
          <ClassSelect value={filter.classId || 'all'} onChange={v => handleFilterChange({ classId: v === 'all' ? undefined : v })} levelId={filter.levelId} allOption={{ value: 'all', label: t('common.allClasses') }} className="w-36" />
        </div>
        <div className="ml-auto self-end">
          {tab === 'absences' && <ViewToggle view={absView} onViewChange={setAbsView} />}
          {tab === 'lates' && <ViewToggle view={lateView} onViewChange={setLateView} />}
        </div>
      </FilterBar>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="absences" className="gap-2"><UserX className="h-4 w-4" />{t('attendance.absences')} ({absencesRes?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="lates" className="gap-2"><Clock className="h-4 w-4" />{t('attendance.lates')} ({latesRes?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="stats" className="gap-2"><BarChart3 className="h-4 w-4" />{t('common.statistics')}</TabsTrigger>
        </TabsList>

        <TabsContent value="absences" className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" onClick={() => { resetAbsForm(); setAbsDialog(true); }}><Plus className="me-1 h-4 w-4" /><span className="hidden sm:inline">{t('common.add')} </span>{t('attendance.absences')}</Button>
            <AttendanceQRScanner entityType="students" mode="single" onScanned={handleScanSingleAbs} trigger={<Button size="sm" variant="outline"><ScanLine className="me-1 h-4 w-4" /><span className="hidden sm:inline">{t('common.scanAdd')}</span></Button>} />
            <Button size="sm" variant="outline" onClick={() => { setBulkRows([{ studentId: '', date: today(), isJustified: false }]); setBulkAbsDialog(true); }}><ListPlus className="me-1 h-4 w-4" /><span className="hidden sm:inline">{t('common.bulkAdd')}</span></Button>
            <AttendanceQRScanner entityType="students" mode="bulk" onScanned={handleScanBulkAbs} trigger={<Button size="sm" variant="outline"><ScanLine className="me-1 h-4 w-4" /><span className="hidden sm:inline">{t('attendance.bulkScan')}</span></Button>} />
            <Button size="sm" variant="outline" onClick={() => setImportAbsOpen(true)}><Upload className="me-1 h-4 w-4" /><span className="hidden sm:inline">{t('common.import')}</span></Button>
            <Button size="sm" variant="outline" onClick={() => studentAttendanceApi.exportExcel(filter)}><Download className="me-1 h-4 w-4" /><span className="hidden sm:inline">{t('common.export')}</span></Button>
          </div>
          <BulkActionBar selectedCount={absBulk.count} onApprove={() => bulkAbsStatusMut.mutate({ ids: [...absBulk.selectedIds], status: 'APPROVED' })} onRemoveApproval={() => bulkAbsStatusMut.mutate({ ids: [...absBulk.selectedIds], status: 'PENDING' })} onDelete={() => bulkAbsDeleteMut.mutate([...absBulk.selectedIds])} />
          {absLoading ? <Skeleton className="h-48 w-full" /> : absView === 'calendar' ? (
            <AttendanceCalendarView
              items={absences}
              type="absences"
              getEntityName={(item) => getStudentName(item as StudentAbsence)}
              onEdit={(item) => { resetAbsForm(item as any); setEditingAbsence(item as any); }}
              onDelete={(item) => setDeleteTarget({ id: item.id, type: 'absence' })}
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><Checkbox checked={absBulk.isAllSelected} onCheckedChange={() => absBulk.toggleAll()} /></TableHead>
                      <TableHead>{t('common.student')}</TableHead><TableHead>{t('common.date')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead>{t('common.justified')}</TableHead><TableHead>{t('common.reason')}</TableHead><TableHead className="w-24">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absences.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t('attendance.noAbsences')}</TableCell></TableRow> :
                      absences.map(a => (
                        <TableRow key={a.id}>
                          <TableCell><Checkbox checked={absBulk.selectedIds.has(a.id)} onCheckedChange={() => absBulk.toggle(a.id)} /></TableCell>
                          <TableCell>{getStudentName(a)}</TableCell>
                          <TableCell>{a.date}</TableCell>
                          <TableCell><ApprovalStatusBadge status={a.status} /></TableCell>
                          <TableCell><Badge variant={a.isJustified ? 'default' : 'destructive'}>{a.isJustified ? t('common.yes') : t('common.no')}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{a.reason || '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { resetAbsForm(a); setEditingAbsence(a); }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ id: a.id, type: 'absence' })}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={absPage} totalPages={absencesRes?.totalPages ?? 1} total={absencesRes?.total ?? 0} onPageChange={setAbsPage} disabled={absLoading} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="lates" className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" onClick={() => { resetLateForm(); setLateDialog(true); }}><Plus className="me-2 h-4 w-4" />{t('attendance.addLate')}</Button>
            <AttendanceQRScanner entityType="students" mode="single" onScanned={handleScanSingleLate} trigger={<Button size="sm" variant="outline"><ScanLine className="me-2 h-4 w-4" />{t('common.scanAdd')}</Button>} />
            <Button size="sm" variant="outline" onClick={() => { setBulkRows([{ studentId: '', date: today(), isJustified: false, period: 10 }]); setBulkLateDialog(true); }}><ListPlus className="me-2 h-4 w-4" />{t('common.bulkAdd')}</Button>
            <AttendanceQRScanner entityType="students" mode="bulk" onScanned={handleScanBulkLate} trigger={<Button size="sm" variant="outline"><ScanLine className="me-2 h-4 w-4" />{t('attendance.bulkScan')}</Button>} />
            <Button size="sm" variant="outline" onClick={() => setImportLateOpen(true)}><Upload className="me-2 h-4 w-4" />{t('common.import')}</Button>
            <Button size="sm" variant="outline" onClick={() => studentAttendanceApi.exportExcel(filter)}><Download className="me-2 h-4 w-4" />{t('common.export')}</Button>
          </div>
          <BulkActionBar selectedCount={lateBulk.count} onApprove={() => bulkLateStatusMut.mutate({ ids: [...lateBulk.selectedIds], status: 'APPROVED' })} onRemoveApproval={() => bulkLateStatusMut.mutate({ ids: [...lateBulk.selectedIds], status: 'PENDING' })} onDelete={() => bulkLateDeleteMut.mutate([...lateBulk.selectedIds])} />
          {lateLoading ? <Skeleton className="h-48 w-full" /> : lateView === 'calendar' ? (
            <AttendanceCalendarView
              items={lates}
              type="lates"
              getEntityName={(item) => getStudentName(item as StudentLate)}
              onEdit={(item) => { resetLateForm(item as any); setEditingLate(item as any); }}
              onDelete={(item) => setDeleteTarget({ id: item.id, type: 'late' })}
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-10"><Checkbox checked={lateBulk.isAllSelected} onCheckedChange={() => lateBulk.toggleAll()} /></TableHead>
                    <TableHead>{t('common.student')}</TableHead><TableHead>{t('common.date')}</TableHead><TableHead>{t('common.period')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead>{t('common.justified')}</TableHead><TableHead>{t('common.reason')}</TableHead><TableHead className="w-24">{t('common.actions')}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lates.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t('attendance.noLates')}</TableCell></TableRow> :
                      lates.map(l => (
                        <TableRow key={l.id}>
                          <TableCell><Checkbox checked={lateBulk.selectedIds.has(l.id)} onCheckedChange={() => lateBulk.toggle(l.id)} /></TableCell>
                          <TableCell>{getStudentName(l)}</TableCell>
                          <TableCell>{l.date}</TableCell>
                          <TableCell>{l.period} {t('attendance.min')}</TableCell>
                          <TableCell><ApprovalStatusBadge status={l.status} /></TableCell>
                          <TableCell><Badge variant={l.isJustified ? 'default' : 'destructive'}>{l.isJustified ? t('common.yes') : t('common.no')}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{l.reason || '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { resetLateForm(l); setEditingLate(l); }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ id: l.id, type: 'late' })}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={latePage} totalPages={latesRes?.totalPages ?? 1} total={latesRes?.total ?? 0} onPageChange={setLatePage} disabled={lateLoading} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats">
          {stats ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t('attendance.totalAbsences')}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.totalAbsences}</p><p className="text-xs text-muted-foreground">{stats.justifiedAbsences} {t('attendance.justified').toLowerCase()} · {stats.unjustifiedAbsences} {t('attendance.unjustified').toLowerCase()}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t('attendance.totalLates')}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.totalLates}</p><p className="text-xs text-muted-foreground">{stats.justifiedLates} {t('attendance.justified').toLowerCase()} · {stats.unjustifiedLates} {t('attendance.unjustified').toLowerCase()}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t('attendance.avgLatePeriod')}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.averageLatePeriod} {t('attendance.min')}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t('attendance.justificationRate')}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.totalAbsences + stats.totalLates > 0 ? Math.round(((stats.justifiedAbsences + stats.justifiedLates) / (stats.totalAbsences + stats.totalLates)) * 100) : 0}%</p></CardContent></Card>
            </div>
          ) : <Skeleton className="h-32 w-full" />}
        </TabsContent>
      </Tabs>

      <Dialog open={absDialog || !!editingAbsence} onOpenChange={o => { if (!o) { setAbsDialog(false); setEditingAbsence(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAbsence ? t('attendance.editAbsence') : t('attendance.addAbsence')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.student')}</Label>
              <StudentSelect value={formStudentId} onChange={setFormStudentId} requiredResult={formStudentId ? [formStudentId] : []} className="w-full" />
            </div>
            <div className="space-y-2"><Label>{t('common.date')}</Label><DatePickerField value={formDate} onChange={setFormDate} /></div>
            <div className="flex items-center gap-2"><Switch checked={formJustified} onCheckedChange={v => { setFormJustified(v); if (!v) setFormReason(''); }} /><Label>{t('common.justified')}</Label></div>
            {formJustified && <div className="space-y-2"><Label>{t('common.reason')}</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} placeholder={t('attendance.enterReason')} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAbsDialog(false); setEditingAbsence(null); }}>{t('common.cancel')}</Button>
            <Button onClick={handleAbsSubmit}>{editingAbsence ? t('common.update') : t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lateDialog || !!editingLate} onOpenChange={o => { if (!o) { setLateDialog(false); setEditingLate(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingLate ? t('attendance.editLate') : t('attendance.addLate')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.student')}</Label>
              <StudentSelect value={formStudentId} onChange={setFormStudentId} requiredResult={formStudentId ? [formStudentId] : []} className="w-full" />
            </div>
            <div className="space-y-2"><Label>{t('common.date')}</Label><DatePickerField value={formDate} onChange={setFormDate} /></div>
            <div className="space-y-2"><Label>{t('attendance.periodOfLate')}</Label><Input type="number" min={1} value={formPeriod} onChange={e => setFormPeriod(parseInt(e.target.value) || 0)} /></div>
            <div className="flex items-center gap-2"><Switch checked={formJustified} onCheckedChange={v => { setFormJustified(v); if (!v) setFormReason(''); }} /><Label>{t('common.justified')}</Label></div>
            {formJustified && <div className="space-y-2"><Label>{t('common.reason')}</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} placeholder={t('attendance.enterReason')} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLateDialog(false); setEditingLate(null); }}>{t('common.cancel')}</Button>
            <Button onClick={handleLateSubmit}>{editingLate ? t('common.update') : t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAbsDialog} onOpenChange={setBulkAbsDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('attendance.bulkAddAbsences')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1"><Label className="text-xs">{t('common.numberOfRows')}</Label><Input type="number" min={1} max={50} value={bulkRowCount} onChange={e => setBulkRowCount(Math.max(1, Number(e.target.value)))} className="w-24" /></div>
              <Button variant="outline" size="sm" onClick={generateBulkRows}>{t('common.generateRows')}</Button>
            </div>
            <div className="flex items-center gap-2"><Switch checked={bulkShared} onCheckedChange={setBulkShared} /><Label className="text-sm">{t('common.sharedSettings')}</Label></div>
            {bulkShared && (
              <div className="flex gap-3 flex-wrap p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1"><Label className="text-xs">{t('common.date')}</Label><DatePickerField value={bulkSharedDate} onChange={setBulkSharedDate} className="w-40" /></div>
              </div>
            )}
            <div className="space-y-2">
            {bulkRows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-end flex-wrap border-b border-border pb-2">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label className="text-xs">{t('common.student')}</Label>
                  <StudentSelect value={row.studentId} onChange={v => updateBulkRow(idx, 'studentId', v)} requiredResult={row.studentId ? [row.studentId] : []} disabledIds={bulkRows.filter((_, i) => i !== idx).map(r => r.studentId).filter(Boolean)} className="w-full" />
                </div>
                <div className="flex items-center gap-1 pb-1"><Switch checked={row.isJustified} onCheckedChange={v => { updateBulkRow(idx, 'isJustified', v); if (!v) updateBulkRow(idx, 'reason', ''); }} /><Label className="text-xs">{t('common.justified')}</Label></div>
                {!bulkShared && <div className="space-y-1"><Label className="text-xs">{t('common.date')}</Label><DatePickerField value={row.date} onChange={v => updateBulkRow(idx, 'date', v)} className="w-36" /></div>}
                {row.isJustified && <div className="w-full space-y-1"><Label className="text-xs">{t('common.reason')}</Label><Input value={row.reason || ''} onChange={e => updateBulkRow(idx, 'reason', e.target.value)} placeholder={t('common.reason')} /></div>}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeBulkRow(idx)} disabled={bulkRows.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addBulkRow}><Plus className="me-2 h-4 w-4" />{t('common.addRow')}</Button>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBulkAbsDialog(false)}>{t('common.cancel')}</Button><Button onClick={() => { const valid = bulkRows.filter(r => r.studentId); if (!valid.length) { toast.error(t('attendance.addValidRow')); return; } const ids = valid.map(r => r.studentId); if (new Set(ids).size !== ids.length) { toast.error(t('attendance.duplicateEntity')); return; } bulkAbsMut.mutate(valid.map(r => ({ studentId: r.studentId, date: bulkShared ? bulkSharedDate : r.date, isJustified: r.isJustified, reason: r.isJustified ? r.reason : undefined }))); }}>{t('attendance.addCountAbsences', { count: bulkRows.filter(r => r.studentId).length })}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkLateDialog} onOpenChange={setBulkLateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('attendance.bulkAddLates')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1"><Label className="text-xs">{t('common.numberOfRows')}</Label><Input type="number" min={1} max={50} value={bulkRowCount} onChange={e => setBulkRowCount(Math.max(1, Number(e.target.value)))} className="w-24" /></div>
              <Button variant="outline" size="sm" onClick={generateBulkRows}>{t('common.generateRows')}</Button>
            </div>
            <div className="flex items-center gap-2"><Switch checked={bulkShared} onCheckedChange={setBulkShared} /><Label className="text-sm">{t('common.sharedSettings')}</Label></div>
            {bulkShared && (
              <div className="flex gap-3 flex-wrap p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1"><Label className="text-xs">{t('common.date')}</Label><DatePickerField value={bulkSharedDate} onChange={setBulkSharedDate} className="w-40" /></div>
              </div>
            )}
            <div className="space-y-2">
            {bulkRows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-end flex-wrap border-b border-border pb-2">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label className="text-xs">{t('common.student')}</Label>
                  <StudentSelect value={row.studentId} onChange={v => updateBulkRow(idx, 'studentId', v)} requiredResult={row.studentId ? [row.studentId] : []} disabledIds={bulkRows.filter((_, i) => i !== idx).map(r => r.studentId).filter(Boolean)} className="w-full" />
                </div>
                <div className="space-y-1"><Label className="text-xs">{t('common.period')}</Label><Input type="number" min={1} value={row.period ?? 10} onChange={e => updateBulkRow(idx, 'period', parseInt(e.target.value) || 0)} className="w-24" /></div>
                <div className="flex items-center gap-1 pb-1"><Switch checked={row.isJustified} onCheckedChange={v => { updateBulkRow(idx, 'isJustified', v); if (!v) updateBulkRow(idx, 'reason', ''); }} /><Label className="text-xs">{t('common.justified')}</Label></div>
                {!bulkShared && <div className="space-y-1"><Label className="text-xs">{t('common.date')}</Label><DatePickerField value={row.date} onChange={v => updateBulkRow(idx, 'date', v)} className="w-36" /></div>}
                {row.isJustified && <div className="w-full space-y-1"><Label className="text-xs">{t('common.reason')}</Label><Input value={row.reason || ''} onChange={e => updateBulkRow(idx, 'reason', e.target.value)} placeholder={t('common.reason')} /></div>}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeBulkRow(idx)} disabled={bulkRows.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addBulkRow}><Plus className="me-2 h-4 w-4" />{t('common.addRow')}</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkLateDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => { const valid = bulkRows.filter(r => r.studentId); if (!valid.length) { toast.error(t('attendance.addValidRow')); return; } const ids = valid.map(r => r.studentId); if (new Set(ids).size !== ids.length) { toast.error(t('attendance.duplicateEntity')); return; } bulkLateMut.mutate(valid.map(r => ({ studentId: r.studentId, date: bulkShared ? bulkSharedDate : r.date, isJustified: r.isJustified, reason: r.isJustified ? r.reason : undefined, period: r.period ?? 10 }))); }}>{t('attendance.addCountLates', { count: bulkRows.filter(r => r.studentId).length })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: deleteTarget?.type === 'absence' ? t('attendance.absences').toLowerCase() : t('attendance.lates').toLowerCase() })}</AlertDialogTitle><AlertDialogDescription>{t('common.deleteConfirmDescAction')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelImportDialog open={importAbsOpen} onOpenChange={setImportAbsOpen} importTarget="file" onImport={handleImportAbsences} expectedColumns={['Student ID', 'Date', 'Justified', 'Reason']} />
      <ExcelImportDialog open={importLateOpen} onOpenChange={setImportLateOpen} importTarget="file" onImport={handleImportLates} expectedColumns={['Student ID', 'Date', 'Period', 'Justified', 'Reason']} />
    </div>
  );
}
