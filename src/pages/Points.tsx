import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { pointApi } from '@/services/note-point-api';
import { studentApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FilterBar } from '@/components/FilterBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerField } from '@/components/DatePickerField';
import { AttendanceQRScanner } from '@/components/AttendanceQRScanner';
import { Plus, Trash2, ListPlus } from 'lucide-react';
import { toast } from 'sonner';

const today = () => new Date().toISOString().split('T')[0];

export default function Points() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<{ studentId?: string; type?: 'positive' | 'negative'; dateFrom?: string; dateTo?: string }>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [formStudentId, setFormStudentId] = useState('');
  const [formType, setFormType] = useState<'positive' | 'negative'>('positive');
  const [formAmount, setFormAmount] = useState(1);
  const [formDate, setFormDate] = useState(today());

  // Bulk state
  const [bulkRowCount, setBulkRowCount] = useState(3);
  const [bulkShared, setBulkShared] = useState(true);
  const [bulkSharedType, setBulkSharedType] = useState<'positive' | 'negative'>('positive');
  const [bulkSharedDate, setBulkSharedDate] = useState(today());
  const [bulkRows, setBulkRows] = useState<{ studentId: string; type: 'positive' | 'negative'; amount: number; date: string }[]>([
    { studentId: '', type: 'positive', amount: 1, date: today() }
  ]);

  const { data: pointsRes, isLoading } = useQuery({ queryKey: ['points', filter], queryFn: () => pointApi.getAll(filter) });
  const { data: studentsRes } = useQuery({ queryKey: ['students-all'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });

  const pointsList = pointsRes?.data || [];
  const students = studentsRes?.data || [];

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['points'] }); };

  const createMut = useMutation({
    mutationFn: (d: { studentId: string; type: 'positive' | 'negative'; amount: number; date: string }) => pointApi.create(d),
    onSuccess: () => { invalidate(); setAddOpen(false); toast.success(t('points.pointAdded')); },
  });
  const bulkMut = useMutation({
    mutationFn: (d: { studentId: string; type: 'positive' | 'negative'; amount: number; date: string }[]) => pointApi.createBulk(d),
    onSuccess: (res) => { invalidate(); setBulkOpen(false); toast.success(res.message); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => pointApi.delete(id),
    onSuccess: () => { invalidate(); setDeleteId(null); toast.success(t('points.pointDeleted')); },
  });

  const getStudentName = (id: string) => { const s = students.find(x => x.id === id); return s ? `${s.firstname} ${s.lastname}` : id; };

  const totalPositive = pointsList.filter(p => p.type === 'positive').reduce((s, p) => s + p.amount, 0);
  const totalNegative = pointsList.filter(p => p.type === 'negative').reduce((s, p) => s + p.amount, 0);

  const openAdd = () => { setFormStudentId(''); setFormType('positive'); setFormAmount(1); setFormDate(today()); setAddOpen(true); };
  const openBulk = () => {
    setBulkShared(true);
    setBulkSharedType('positive');
    setBulkSharedDate(today());
    setBulkRowCount(3);
    setBulkRows(Array.from({ length: 3 }, () => ({ studentId: '', type: 'positive' as const, amount: 1, date: today() })));
    setBulkOpen(true);
  };

  const generateBulkRows = () => {
    const count = Math.max(1, Math.min(50, bulkRowCount));
    setBulkRows(Array.from({ length: count }, () => ({ studentId: '', type: 'positive' as const, amount: 1, date: today() })));
  };

  const handleSubmit = () => {
    if (!formStudentId) { toast.error(t('points.selectStudentError')); return; }
    if (formAmount <= 0) { toast.error(t('points.amountPositive')); return; }
    createMut.mutate({ studentId: formStudentId, type: formType, amount: formAmount, date: formDate });
  };

  const handleBulkSubmit = () => {
    const rows = bulkRows.map(r => ({
      studentId: r.studentId,
      type: bulkShared ? bulkSharedType : r.type,
      amount: r.amount,
      date: bulkShared ? bulkSharedDate : r.date,
    }));
    const valid = rows.filter(r => r.studentId && r.amount > 0);
    if (!valid.length) { toast.error(t('points.addValidRow')); return; }
    bulkMut.mutate(valid);
  };

  const handleScanSingle = (ids: string[]) => {
    if (ids[0]) { setFormStudentId(ids[0]); setFormType('positive'); setFormAmount(1); setFormDate(today()); setAddOpen(true); }
  };
  const handleScanBulk = (ids: string[]) => {
    setBulkShared(true);
    setBulkSharedType('positive');
    setBulkSharedDate(today());
    setBulkRows(ids.map(id => ({ studentId: id, type: 'positive' as const, amount: 1, date: today() })));
    setBulkRowCount(ids.length);
    setBulkOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('points.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('points.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AttendanceQRScanner mode="single" entityType="students" onScanned={handleScanSingle} label={t('points.scanSingle')} />
          <AttendanceQRScanner mode="bulk" entityType="students" onScanned={handleScanBulk} label={t('points.scanBulk')} />
          <Button variant="outline" onClick={openBulk}><ListPlus className="me-2 h-4 w-4" />{t('notes.bulkAdd')}</Button>
          <Button onClick={openAdd}><Plus className="me-2 h-4 w-4" />{t('points.addPoint')}</Button>
        </div>
      </div>

      <FilterBar showClear={!!(filter.studentId || filter.type || filter.dateFrom || filter.dateTo)} onClear={() => setFilter({})}>
        <div className="space-y-1">
          <Label className="text-xs">{t('common.student')}</Label>
          <Select value={filter.studentId || 'all'} onValueChange={v => setFilter(f => ({ ...f, studentId: v === 'all' ? undefined : v }))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('common.allStudents')}</SelectItem>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('common.type')}</Label>
          <Select value={filter.type || 'all'} onValueChange={v => setFilter(f => ({ ...f, type: v === 'all' ? undefined : v as any }))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="positive">{t('common.positive')}</SelectItem>
              <SelectItem value="negative">{t('common.negative')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex flex-col"><Label className="text-xs">{t('common.dateFrom')}</Label><DatePickerField value={filter.dateFrom || ''} onChange={v => setFilter(f => ({ ...f, dateFrom: v || undefined }))} placeholder={t('common.from')} className="w-40" /></div>
        <div className="space-y-1 flex flex-col"><Label className="text-xs">{t('common.dateTo')}</Label><DatePickerField value={filter.dateTo || ''} onChange={v => setFilter(f => ({ ...f, dateTo: v || undefined }))} placeholder={t('common.to')} className="w-40" /></div>
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('common.positive')}</p><p className="text-2xl font-bold text-green-600">+{totalPositive}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('common.negative')}</p><p className="text-2xl font-bold text-destructive">−{totalNegative}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('common.net')}</p><p className={`text-2xl font-bold ${totalPositive - totalNegative >= 0 ? 'text-green-600' : 'text-destructive'}`}>{totalPositive - totalNegative >= 0 ? '+' : ''}{totalPositive - totalNegative}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : pointsList.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">{t('points.noPoints')}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('common.student')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('common.amount')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('common.source')}</TableHead>
                    <TableHead className="w-16">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointsList.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="font-medium">{getStudentName(p.studentId)}</TableCell>
                      <TableCell>
                        <Badge variant={p.type === 'positive' ? 'default' : 'destructive'}>
                          {p.type === 'positive' ? '+' : '−'} {p.type === 'positive' ? t('common.positive') : t('common.negative')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{p.type === 'positive' ? '+' : '−'}{p.amount}</TableCell>
                      <TableCell className="hidden sm:table-cell">{p.sourceNoteId ? <Badge variant="outline">{t('common.fromNote')}</Badge> : <Badge variant="secondary">{t('common.manual')}</Badge>}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Point Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('points.addPoint')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.student')}</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger><SelectValue placeholder={t('common.selectStudent')} /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('common.type')}</Label>
                <Select value={formType} onValueChange={(v: 'positive' | 'negative') => setFormType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">{t('common.positive')}</SelectItem>
                    <SelectItem value="negative">{t('common.negative')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('common.amount')}</Label>
                <Input type="number" min={1} value={formAmount} onChange={e => setFormAmount(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('common.date')}</Label>
              <DatePickerField value={formDate} onChange={setFormDate} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>{t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('points.bulkAddPoints')}</DialogTitle></DialogHeader>
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
                <div className="space-y-1 w-32">
                  <Label className="text-xs">{t('common.type')}</Label>
                  <Select value={bulkSharedType} onValueChange={(v: 'positive' | 'negative') => setBulkSharedType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positive">{t('common.positive')}</SelectItem>
                      <SelectItem value="negative">{t('common.negative')}</SelectItem>
                    </SelectContent>
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
                    <Select value={row.studentId} onValueChange={v => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, studentId: v } : r))}>
                      <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                      <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">{t('common.amount')}</Label>
                    <Input type="number" min={1} value={row.amount} onChange={e => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: Number(e.target.value) } : r))} />
                  </div>
                  {!bulkShared && (
                    <>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">{t('common.type')}</Label>
                        <Select value={row.type} onValueChange={(v: 'positive' | 'negative') => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, type: v } : r))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="positive">{t('common.positive')}</SelectItem>
                            <SelectItem value="negative">{t('common.negative')}</SelectItem>
                          </SelectContent>
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
              <Button variant="outline" size="sm" onClick={() => setBulkRows(prev => [...prev, { studentId: '', type: 'positive', amount: 1, date: today() }])}>
                <Plus className="me-2 h-4 w-4" />{t('points.addRow')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleBulkSubmit} disabled={bulkMut.isPending}>{t('points.submitAll')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('points.deletePoint')}</AlertDialogTitle>
            <AlertDialogDescription>{t('points.deletePointDesc')}</AlertDialogDescription>
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
