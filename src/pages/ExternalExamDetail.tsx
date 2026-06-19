import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { externalExamApi } from '@/services/exam-api';
import { studentApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, Plus, Trash2, BookOpen, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function ExternalExamDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCount, setEditCount] = useState(0);
  const [editKey, setEditKey] = useState<Record<number, string>>({});

  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreStudentId, setScoreStudentId] = useState('');
  const [scoreValue, setScoreValue] = useState(0);

  const { data: examRes } = useQuery({ queryKey: ['external-exam', id], queryFn: () => externalExamApi.getById(id!) });
  const exam = examRes?.data;

  const { data: attemptsRes } = useQuery({
    queryKey: ['external-exam-attempts', id],
    queryFn: () => externalExamApi.getAttempts(id!),
    enabled: !!exam,
  });
  const attempts = attemptsRes?.data ?? [];

  const { data: studentsRes } = useQuery({ queryKey: ['students-all'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });
  const students = studentsRes?.data ?? [];

  const updateMut = useMutation({
    mutationFn: () => externalExamApi.update(id!, { name: editName, totalQuestions: editCount, answerKey: editKey }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['external-exam', id] }); toast({ title: t('externalExams.examUpdated') }); setEditOpen(false); },
  });

  const addScoreMut = useMutation({
    mutationFn: () => externalExamApi.addManualScore(id!, scoreStudentId, scoreValue),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['external-exam-attempts', id] }); toast({ title: t('externalExams.scoreAdded') }); setScoreOpen(false); },
  });

  const getStudentName = (sid: string) => {
    const s = students.find(st => st.id === sid);
    return s ? `${s.firstname} ${s.lastname}` : sid;
  };

  const openEdit = () => {
    if (!exam) return;
    setEditName(exam.name);
    setEditCount(exam.totalQuestions);
    setEditKey({ ...exam.answerKey });
    setEditOpen(true);
  };

  const openAddScore = () => {
    setScoreStudentId('');
    setScoreValue(0);
    setScoreOpen(true);
  };

  if (!exam) return <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/external-exams')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{exam.name}</h1>
            <p className="text-sm text-muted-foreground">{exam.totalQuestions} {t('exams.questions').toLowerCase()} · {t('common.created')} {new Date(exam.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEdit}><Edit className="h-4 w-4 mr-2" /> {t('common.edit')}</Button>
          <Button variant="destructive" onClick={() => {
            if (confirm(t('externalExams.deleteExternalExam'))) {
              externalExamApi.delete(id!).then(() => { navigate('/external-exams'); });
            }
          }}><Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}</Button>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info"><BookOpen className="h-4 w-4 mr-1" /> {t('externalExams.infoAnswerKey')}</TabsTrigger>
          <TabsTrigger value="records"><Users className="h-4 w-4 mr-1" /> {t('externalExams.studentRecords')} ({attempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{exam.totalQuestions}</p><p className="text-sm text-muted-foreground">{t('exams.questions')}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{attempts.length}</p><p className="text-sm text-muted-foreground">{t('exams.attempts')}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length * 10) / 10 : '—'}</p><p className="text-sm text-muted-foreground">{t('exams.avgScore')}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">{t('externalExams.answerKey')}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2" dir="ltr">
                {Array.from({ length: exam.totalQuestions }, (_, i) => i + 1).map(qNum => (
                  <div key={qNum} className="border rounded-md p-2 text-center">
                    <span className="text-xs font-bold block">Q{qNum}</span>
                    <span className="text-sm font-semibold text-primary">{exam.answerKey[qNum] || '—'}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openAddScore}><Plus className="h-4 w-4 mr-2" /> {t('externalExams.addScore')}</Button>
          </div>
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.student')}</TableHead>
                    <TableHead>{t('exams.score')}</TableHead>
                    <TableHead>{t('externalExams.totalQuestions')}</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>{t('common.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('externalExams.noRecords')}</TableCell></TableRow>
                  ) : attempts.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-foreground">{getStudentName(a.studentId)}</TableCell>
                      <TableCell>{a.score}</TableCell>
                      <TableCell>{a.totalQuestions}</TableCell>
                      <TableCell>
                        <Badge variant={a.score / a.totalQuestions >= 0.5 ? 'default' : 'destructive'}>
                          {Math.round((a.score / a.totalQuestions) * 100)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(a.completedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('externalExams.editExternalExam')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('common.name')}</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div>
              <Label>{t('externalExams.numberOfQuestions')}</Label>
              <Input type="number" min={1} max={200} value={editCount} onChange={e => setEditCount(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>{t('externalExams.answerKey')}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2 max-h-[300px] overflow-y-auto" dir="ltr">
                {Array.from({ length: editCount }, (_, i) => i + 1).map(qNum => (
                  <div key={qNum} className="border rounded-md p-2">
                    <span className="text-xs font-bold block mb-1">Q{qNum}</span>
                    <div className="flex gap-1">
                      {OPTION_LABELS.map(opt => (
                        <button key={opt} onClick={() => setEditKey(prev => ({ ...prev, [qNum]: opt }))}
                          className={`w-7 h-7 rounded-full border text-xs font-bold transition-colors ${editKey[qNum] === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30 hover:border-primary/50'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Score Dialog */}
      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('externalExams.addStudentScore')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('common.student')} *</Label>
              <Select value={scoreStudentId} onValueChange={setScoreStudentId}>
                <SelectTrigger><SelectValue placeholder={t('common.selectStudent')} /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('exams.score')}</Label>
              <Input type="number" min={0} max={exam.totalQuestions} value={scoreValue} onChange={e => setScoreValue(parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">{t('externalExams.outOfQuestions', { count: exam.totalQuestions })}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addScoreMut.mutate()} disabled={addScoreMut.isPending || !scoreStudentId}>{t('externalExams.addScore')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
