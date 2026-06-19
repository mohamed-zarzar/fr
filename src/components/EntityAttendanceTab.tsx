import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { AttendanceCalendarView } from '@/components/AttendanceCalendarView';
import { DatePickerField } from '@/components/DatePickerField';
import { ViewToggle } from '@/components/ViewToggle';
import { BulkActionBar, useBulkSelection } from '@/components/BulkActionBar';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { toast } from 'sonner';
import { studentAttendanceApi, teacherAttendanceApi, managerAttendanceApi } from '@/services/attendance-api';
import { fetchSessionDefinitions } from '@/services/settings-api';
import { useTranslation } from 'react-i18next';

const today = () => new Date().toISOString().split('T')[0];
const PAGE_LIMIT = 20;

interface EntityAttendanceTabProps {
  entityType: 'student' | 'teacher' | 'manager';
  entityId: string;
  entityName: string;
  recordType: 'absences' | 'lates';
}

export function EntityAttendanceTab({ entityType, entityId, entityName, recordType }: EntityAttendanceTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [formDate, setFormDate] = useState(today());
  const [formJustified, setFormJustified] = useState(false);
  const [formReason, setFormReason] = useState('');
  const [formPeriod, setFormPeriod] = useState(10);
  const [formSessionId, setFormSessionId] = useState('');

  const { data: sessionDefs } = useQuery({
    queryKey: ['session-definitions'],
    queryFn: fetchSessionDefinitions,
    enabled: entityType === 'teacher',
  });
  const sessionOptions = sessionDefs ?? [];

  const filter = {
    entityId,
    page,
    limit: PAGE_LIMIT,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, entityId]);

  useEffect(() => {
    if (entityType === 'teacher' && !formSessionId && sessionOptions.length) {
      setFormSessionId(sessionOptions[0].id);
    }
  }, [entityType, formSessionId, sessionOptions]);

  const api: any = entityType === 'student' ? studentAttendanceApi : entityType === 'teacher' ? teacherAttendanceApi : managerAttendanceApi;

  const absQuery = useQuery<any>({
    queryKey: [`${entityType}-absences`, filter],
    queryFn: () => api.getAbsences(filter),
    enabled: recordType === 'absences',
  });
  const lateQuery = useQuery<any>({
    queryKey: [`${entityType}-lates`, filter],
    queryFn: () => api.getLates(filter),
    enabled: recordType === 'lates',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`${entityType}-absences`] });
    qc.invalidateQueries({ queryKey: [`${entityType}-lates`] });
    qc.invalidateQueries({ queryKey: [`${entityType}-attendance-stats`] });
  };

  const isAbsences = recordType === 'absences';
  const queryRes = isAbsences ? absQuery.data : lateQuery.data;
  const items: any[] = queryRes?.data || [];
  const total = queryRes?.total ?? 0;
  const totalPages = queryRes?.totalPages ?? 1;
  const isLoading = isAbsences ? absQuery.isLoading : lateQuery.isLoading;

  const itemBulk = useBulkSelection(items);

  const bulkStatusMut = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: any }) => {
      if (isAbsences) return (api as any).bulkUpdateAbsenceStatus(ids, status);
      return (api as any).bulkUpdateLateStatus(ids, status);
    },
    onSuccess: () => { invalidate(); itemBulk.clear(); toast.success(t('common.statusUpdated')); },
  });
  const bulkDelMut = useMutation({
    mutationFn: (ids: string[]) => {
      if (isAbsences) return (api as any).bulkDeleteAbsences(ids);
      return (api as any).bulkDeleteLates(ids);
    },
    onSuccess: () => { invalidate(); itemBulk.clear(); toast.success(t('common.bulkDeleted')); },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => {
      if (isAbsences) return (api as any).createAbsence(data);
      return (api as any).createLate(data);
    },
    onSuccess: (res: any) => {
      if (!res.success) { toast.error(res.message); return; }
      invalidate(); setDialogOpen(false);
      toast.success(isAbsences ? t('attendance.absenceAdded') : t('attendance.lateAdded'));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => {
      if (isAbsences) return (api as any).updateAbsence(id, data);
      return (api as any).updateLate(id, data);
    },
    onSuccess: () => { invalidate(); setEditingId(null); setDialogOpen(false); toast.success(t('attendance.updated')); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => {
      if (isAbsences) return (api as any).deleteAbsence(id);
      return (api as any).deleteLate(id);
    },
    onSuccess: () => { invalidate(); toast.success(t('attendance.deleted')); },
  });

  const resetForm = (item?: any) => {
    setFormDate(item?.date || today());
    setFormJustified(item?.isJustified || false);
    setFormReason(item?.reason || '');
    setFormPeriod(item?.period || 10);
    setFormSessionId(item?.sessionId || sessionOptions[0]?.id || '');
  };

  const handleSubmit = () => {
    const idField = entityType === 'student' ? 'studentId' : entityType === 'teacher' ? 'teacherId' : 'managerId';
    const base: any = {
      [idField]: entityId,
      date: formDate,
      isJustified: formJustified,
      reason: formJustified ? formReason : undefined,
    };
    if (entityType === 'teacher') base.sessionId = formSessionId;
    if (!isAbsences) base.period = formPeriod;

    if (editingId) {
      updateMut.mutate({ id: editingId, ...base });
    } else {
      createMut.mutate(base);
    }
  };

  const recordTypeLabel = isAbsences ? t('common.absences').toLowerCase() : t('common.lates').toLowerCase();

  const getSessionLabel = (item: { sessionId?: string; sessionName?: string }) =>
    item.sessionName || sessionOptions.find(s => s.id === item.sessionId)?.name || item.sessionId || '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{total} {recordTypeLabel} — {entityName}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode !== 'calendar' && (
            <>
              <div className="flex flex-col">
                <Label className="text-xs">{t('common.dateFrom')}</Label>
                <DatePickerField value={dateFrom} onChange={setDateFrom} placeholder={t('common.dateFrom')} className="w-32 h-8" />
              </div>
              <div className="flex flex-col">
                <Label className="text-xs">{t('common.dateTo')}</Label>
                <DatePickerField value={dateTo} onChange={setDateTo} placeholder={t('common.dateTo')} className="w-32 h-8" />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }} className="self-end">{t('common.clearFilters')}</Button>
              )}
            </>
          )}
          <div className="self-end"><ViewToggle view={viewMode} onViewChange={setViewMode} /></div>
          <Button size="sm" className="self-end" onClick={() => { resetForm(); setEditingId(null); setDialogOpen(true); }}>
            <Plus className="me-2 h-4 w-4" />{isAbsences ? t('attendance.addAbsence') : t('attendance.addLate')}
          </Button>
        </div>
      </div>

      <BulkActionBar selectedCount={itemBulk.count} onApprove={() => bulkStatusMut.mutate({ ids: [...itemBulk.selectedIds], status: 'APPROVED' })} onRemoveApproval={() => bulkStatusMut.mutate({ ids: [...itemBulk.selectedIds], status: 'PENDING' })} onDelete={() => bulkDelMut.mutate([...itemBulk.selectedIds])} />

      {isLoading ? <Skeleton className="h-48 w-full" /> : viewMode === 'calendar' ? (
        <AttendanceCalendarView
          isShowMixed={false}
          items={items}
          type={recordType}
          showEntity={false}
          onEdit={(item) => { resetForm(item); setEditingId(item.id); setDialogOpen(true); }}
          onDelete={(item) => setDeleteTarget(item.id)}
        />
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={itemBulk.isAllSelected} onCheckedChange={() => itemBulk.toggleAll()} /></TableHead>
                {entityType === 'teacher' && <TableHead>{t('common.session')}</TableHead>}
                <TableHead>{t('common.date')}</TableHead>
                {!isAbsences && <TableHead>{t('common.period')}</TableHead>}
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.justified')}</TableHead>
                <TableHead>{t('common.reason')}</TableHead>
                <TableHead className="w-24">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={entityType === 'teacher' ? 8 : 7} className="text-center text-muted-foreground py-8">{isAbsences ? t('attendance.noAbsences') : t('attendance.noLates')}</TableCell></TableRow>
              ) : items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell><Checkbox checked={itemBulk.selectedIds.has(item.id)} onCheckedChange={() => itemBulk.toggle(item.id)} /></TableCell>
                  {entityType === 'teacher' && <TableCell>{getSessionLabel(item)}</TableCell>}
                  <TableCell>{item.date}</TableCell>
                  {!isAbsences && <TableCell>{item.period} {t('attendance.min')}</TableCell>}
                  <TableCell><ApprovalStatusBadge status={item.status} /></TableCell>
                  <TableCell><Badge variant={item.isJustified ? 'default' : 'destructive'}>{item.isJustified ? t('common.yes') : t('common.no')}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.reason || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { resetForm(item); setEditingId(item.id); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {viewMode === 'table' && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {t('common.page')} {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              {t('common.previous')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditingId(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? t('common.edit') : t('common.add')} {isAbsences ? t('common.absences') : t('common.lates')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {entityType === 'teacher' && (
              <div className="space-y-2">
                <Label>{t('common.session')}</Label>
                <Select value={formSessionId} onValueChange={setFormSessionId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{sessionOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>{t('common.date')}</Label><DatePickerField value={formDate} onChange={setFormDate} /></div>
            {!isAbsences && <div className="space-y-2"><Label>{t('common.period')}</Label><Input type="number" min={1} value={formPeriod} onChange={e => setFormPeriod(parseInt(e.target.value) || 0)} /></div>}
            <div className="flex items-center gap-2"><Switch checked={formJustified} onCheckedChange={v => { setFormJustified(v); if (!v) setFormReason(''); }} /><Label>{t('common.justified')}</Label></div>
            {formJustified && <div className="space-y-2"><Label>{t('common.reason')}</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} placeholder={t('common.reason')} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); }}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>{editingId ? t('common.update') : t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: isAbsences ? t('common.absences').toLowerCase() : t('common.lates').toLowerCase() })}</AlertDialogTitle><AlertDialogDescription>{t('common.deleteConfirmDescAction')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget) { deleteMut.mutate(deleteTarget); setDeleteTarget(null); } }}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
