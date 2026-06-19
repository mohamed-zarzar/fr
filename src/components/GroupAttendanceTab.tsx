import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { AttendanceCalendarView } from '@/components/AttendanceCalendarView';
import { DatePickerField } from '@/components/DatePickerField';
import { ViewToggle } from '@/components/ViewToggle';
import { Pagination } from '@/components/DataTable';
import { toast } from 'sonner';
import { studentAttendanceApi } from '@/services/attendance-api';
import { useTranslation } from 'react-i18next';
import type { StudentAbsence, StudentLate } from '@/types/attendance';

const today = () => new Date().toISOString().split('T')[0];
const PAGE_LIMIT = 20;

interface StudentInfo {
  id: string;
  firstname: string;
  lastname: string;
}

interface GroupAttendanceTabProps {
  students: StudentInfo[];
  recordType: 'absences' | 'lates';
  title?: string;
  classId?: string;
  levelId?: string;
}

export function GroupAttendanceTab({ students, recordType, title, classId, levelId }: GroupAttendanceTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formStudentId, setFormStudentId] = useState('');
  const [formDate, setFormDate] = useState(today());
  const [formJustified, setFormJustified] = useState(false);
  const [formReason, setFormReason] = useState('');
  const [formPeriod, setFormPeriod] = useState(10);

  const isAbsences = recordType === 'absences';
  const useServerFilter = !!(classId || levelId);
  const studentIds = useMemo(() => students.map((s) => s.id), [students]);

  const serverFilter = useMemo(
    () => ({
      classId,
      levelId,
      page,
      limit: PAGE_LIMIT,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [classId, levelId, page, dateFrom, dateTo],
  );

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, classId, levelId]);

  const { data: absencesRes, isLoading: absLoading } = useQuery({
    queryKey: ['student-absences', classId, levelId, page, dateFrom, dateTo],
    queryFn: () =>
      useServerFilter
        ? studentAttendanceApi.getAbsences(serverFilter)
        : studentAttendanceApi.getAbsences(),
    enabled: isAbsences,
  });
  const { data: latesRes, isLoading: lateLoading } = useQuery({
    queryKey: ['student-lates', classId, levelId, page, dateFrom, dateTo],
    queryFn: () =>
      useServerFilter
        ? studentAttendanceApi.getLates(serverFilter)
        : studentAttendanceApi.getLates(),
    enabled: !isAbsences,
  });

  const isLoading = isAbsences ? absLoading : lateLoading;
  const queryRes = isAbsences ? absencesRes : latesRes;
  const rawItems: (StudentAbsence | StudentLate)[] = queryRes?.data ?? [];

  const items = useMemo(() => {
    if (useServerFilter) return rawItems;
    let filtered = rawItems.filter((i) => studentIds.includes(i.studentId));
    if (dateFrom) filtered = filtered.filter((i) => i.date >= dateFrom);
    if (dateTo) filtered = filtered.filter((i) => i.date <= dateTo);
    return filtered;
  }, [rawItems, studentIds, dateFrom, dateTo, useServerFilter]);

  const total = useServerFilter ? (queryRes?.total ?? 0) : items.length;
  const totalPages = useServerFilter ? (queryRes?.totalPages ?? 1) : 1;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['student-absences'] });
    qc.invalidateQueries({ queryKey: ['student-absences-all'] });
    qc.invalidateQueries({ queryKey: ['student-lates'] });
    qc.invalidateQueries({ queryKey: ['student-lates-all'] });
    qc.invalidateQueries({ queryKey: ['student-attendance-stats'] });
  };

  const createMut = useMutation({
    mutationFn: (data: { studentId: string; date: string; isJustified: boolean; reason?: string; period?: number }) =>
      isAbsences ? studentAttendanceApi.createAbsence(data) : studentAttendanceApi.createLate({ ...data, period: data.period ?? 0 }),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      invalidate();
      setDialogOpen(false);
      toast.success(isAbsences ? t('attendance.absenceAdded') : t('attendance.lateAdded'));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; studentId?: string; date?: string; isJustified?: boolean; reason?: string; period?: number }) =>
      isAbsences ? studentAttendanceApi.updateAbsence(id, data) : studentAttendanceApi.updateLate(id, data),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setDialogOpen(false);
      toast.success(t('attendance.updated'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => (isAbsences ? studentAttendanceApi.deleteAbsence(id) : studentAttendanceApi.deleteLate(id)),
    onSuccess: () => {
      invalidate();
      toast.success(t('attendance.deleted'));
    },
  });

  const getStudentName = (studentId: string, item?: StudentAbsence | StudentLate) => {
    const s = students.find((x) => x.id === studentId);
    if (s) return `${s.firstname} ${s.lastname}`;
    if (item?.firstName && item?.lastName) return `${item.firstName} ${item.lastName}`;
    return studentId;
  };

  const resetForm = (item?: StudentAbsence | StudentLate) => {
    setFormStudentId(item?.studentId || '');
    setFormDate(item?.date || today());
    setFormJustified(item?.isJustified || false);
    setFormReason(item?.reason || '');
    setFormPeriod(item && 'period' in item ? item.period : 10);
  };

  const handleSubmit = () => {
    if (!formStudentId) {
      toast.error(t('common.selectStudent'));
      return;
    }
    const base = {
      studentId: formStudentId,
      date: formDate,
      isJustified: formJustified,
      reason: formJustified ? formReason : undefined,
    };
    if (!isAbsences) {
      if (editingId) updateMut.mutate({ id: editingId, ...base, period: formPeriod });
      else createMut.mutate({ ...base, period: formPeriod });
    } else if (editingId) {
      updateMut.mutate({ id: editingId, ...base });
    } else {
      createMut.mutate(base);
    }
  };

  const recordTypeLabel = isAbsences ? t('common.absences').toLowerCase() : t('common.lates').toLowerCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} {recordTypeLabel} {title ? `— ${title}` : ''}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode !== 'calendar' && (
            <>
              <div className="flex flex-col">
                <Label className="text-xs">{t('common.dateFrom')}</Label>
                <DatePickerField
                  value={dateFrom}
                  onChange={setDateFrom}
                  placeholder={t('common.dateFrom')}
                  className="w-32 h-8"
                />
              </div>
              <div className="flex flex-col">
                <Label className="text-xs">{t('common.dateTo')}</Label>
                <DatePickerField value={dateTo} onChange={setDateTo} placeholder={t('common.dateTo')} className="w-32 h-8" />
              </div>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="self-end"
                >
                  {t('common.clearFilters')}
                </Button>
              )}
            </>
          )}
          <div className="self-end">
            <ViewToggle view={viewMode} onViewChange={setViewMode} />
          </div>
          <Button
            size="sm"
            className="self-end"
            onClick={() => {
              resetForm();
              setEditingId(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            {isAbsences ? t('attendance.addAbsence') : t('attendance.addLate')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : viewMode === 'calendar' ? (
        <AttendanceCalendarView
          items={items}
          type={recordType}
          getEntityName={(item) => getStudentName(item.studentId, item)}
          showEntity={true}
          onEdit={(item) => {
            resetForm(item);
            setEditingId(item.id);
            setDialogOpen(true);
          }}
          onDelete={(item) => setDeleteTarget(item.id)}
        />
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.student')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                {!isAbsences && <TableHead>{t('common.period')}</TableHead>}
                <TableHead>{t('common.justified')}</TableHead>
                <TableHead>{t('common.reason')}</TableHead>
                <TableHead className="w-24">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAbsences ? 5 : 6} className="text-center text-muted-foreground py-8">
                    {isAbsences ? t('attendance.noAbsences') : t('attendance.noLates')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{getStudentName(item.studentId, item)}</TableCell>
                    <TableCell>{item.date}</TableCell>
                    {!isAbsences && 'period' in item && (
                      <TableCell>
                        {item.period} {t('attendance.min')}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={item.isJustified ? 'default' : 'destructive'}>
                        {item.isJustified ? t('common.yes') : t('common.no')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.reason || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            resetForm(item);
                            setEditingId(item.id);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {useServerFilter && viewMode === 'table' && (
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} disabled={isLoading} />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDialogOpen(false);
            setEditingId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('common.edit') : t('common.add')} {isAbsences ? t('common.absences') : t('common.lates')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.student')}</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.selectStudent')} />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstname} {s.lastname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.date')}</Label>
              <DatePickerField value={formDate} onChange={setFormDate} />
            </div>
            {!isAbsences && (
              <div className="space-y-2">
                <Label>{t('common.period')}</Label>
                <Input type="number" min={1} value={formPeriod} onChange={(e) => setFormPeriod(parseInt(e.target.value) || 0)} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={formJustified}
                onCheckedChange={(v) => {
                  setFormJustified(v);
                  if (!v) setFormReason('');
                }}
              />
              <Label>{t('common.justified')}</Label>
            </div>
            {formJustified && (
              <div className="space-y-2">
                <Label>{t('common.reason')}</Label>
                <Textarea value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder={t('common.reason')} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingId(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editingId ? t('common.update') : t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: recordTypeLabel })}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.deleteConfirmDescAction')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMut.mutate(deleteTarget);
                  setDeleteTarget(null);
                }
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
