import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pointApi, noteTemplateApi } from '@/services/note-point-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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

export function StudentPointsTab({ studentId, studentName }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [formType, setFormType] = useState<'positive' | 'negative'>('positive');
  const [formAmount, setFormAmount] = useState(1);
  const [formDate, setFormDate] = useState(today());

  const { data: pointsRes, isLoading } = useQuery({
    queryKey: ['student-points', studentId],
    queryFn: () => pointApi.getAll({ studentId }),
  });
  const { data: totalRes } = useQuery({
    queryKey: ['student-points-total', studentId],
    queryFn: () => pointApi.getStudentTotal(studentId),
  });

  const pointsList = pointsRes?.data || [];
  const totals = totalRes?.data;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['student-points'] });
    qc.invalidateQueries({ queryKey: ['student-points-total'] });
  };

  const createMut = useMutation({
    mutationFn: (d: { studentId: string; type: 'positive' | 'negative'; amount: number; date: string }) => pointApi.create(d),
    onSuccess: () => { invalidate(); setAddOpen(false); toast.success(t('points.pointAdded')); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => pointApi.delete(id),
    onSuccess: () => { invalidate(); setDeleteId(null); toast.success(t('points.pointDeleted')); },
  });

  const openAdd = () => {
    setFormType('positive');
    setFormAmount(1);
    setFormDate(today());
    setAddOpen(true);
  };

  const handleSubmit = () => {
    if (formAmount <= 0) { toast.error(t('points.amountPositive')); return; }
    createMut.mutate({ studentId, type: formType, amount: formAmount, date: formDate });
  };

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;

  return (
    <div className="space-y-4">
      {totals && (
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('common.positive')}</p><p className="text-xl font-bold text-green-600">+{totals.positive}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('common.negative')}</p><p className="text-xl font-bold text-destructive">−{totals.negative}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('common.net')}</p><p className={`text-xl font-bold ${totals.net >= 0 ? 'text-green-600' : 'text-destructive'}`}>{totals.net >= 0 ? '+' : ''}{totals.net}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('tabs.points')} — {studentName}</CardTitle>
          <Button size="sm" onClick={openAdd}><Plus className="me-2 h-4 w-4" />{t('points.addPoint')}</Button>
        </CardHeader>
        <CardContent className="p-0">
          {pointsList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t('points.noPoints')}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('common.amount')}</TableHead>
                    <TableHead>{t('common.source')}</TableHead>
                    <TableHead className="w-16">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointsList.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell>
                        <Badge variant={p.type === 'positive' ? 'default' : 'destructive'}>
                          {p.type === 'positive' ? '+' : '−'} {p.type === 'positive' ? t('common.positive') : t('common.negative')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{p.type === 'positive' ? '+' : '−'}{p.amount}</TableCell>
                      <TableCell>{p.sourceNoteId ? <Badge variant="outline">{t('common.fromNote')}</Badge> : <Badge variant="secondary">{t('common.manual')}</Badge>}</TableCell>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('points.addPoint')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('points.deletePoint')}</AlertDialogTitle><AlertDialogDescription>{t('points.deletePointDesc')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
