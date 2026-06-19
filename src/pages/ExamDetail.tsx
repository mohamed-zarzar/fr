import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { examApi, attemptApi, lessonApi, unitApi, questionApi } from '@/services/exam-api';
import { studentApi, levelApi, subjectApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Edit, Plus, Trash2, BookOpen, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Question, ExamConfig } from '@/types/exam';
import React from 'react';

export default function ExamDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMaxScore, setEditMaxScore] = useState(100);
  const [editStatus, setEditStatus] = useState<'draft' | 'published'>('published');
  const [editLevelId, setEditLevelId] = useState('');
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editLessonIds, setEditLessonIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<'manual' | 'auto'>('manual');
  const [editEasyCount, setEditEasyCount] = useState(3);
  const [editMediumCount, setEditMediumCount] = useState(3);
  const [editHardCount, setEditHardCount] = useState(2);
  const [editSelectedQuestions, setEditSelectedQuestions] = useState<string[]>([]);

  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreStudentId, setScoreStudentId] = useState('');
  const [scoreValue, setScoreValue] = useState(0);

  const { data: examRes } = useQuery({ queryKey: ['exam', id], queryFn: () => examApi.getById(id!) });
  const exam = examRes?.data;

  const { data: questionsRes } = useQuery({
    queryKey: ['exam-questions', id],
    queryFn: () => examApi.getQuestionsForExam(id!),
    enabled: !!exam,
  });
  const questions: Question[] = questionsRes?.data ?? [];

  const { data: attemptsRes } = useQuery({
    queryKey: ['exam-attempts', id],
    queryFn: () => attemptApi.getByExam(id!),
    enabled: !!exam,
  });
  const attempts = attemptsRes?.data ?? [];

  const { data: studentsRes } = useQuery({ queryKey: ['students-all'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });
  const students = studentsRes?.data ?? [];

  const { data: levelsRes } = useQuery({ queryKey: ['levels-all'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });
  const { data: subjectsRes } = useQuery({ queryKey: ['subjects-all'], queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }) });
  const { data: allLessonsRes } = useQuery({ queryKey: ['lessons-flat'], queryFn: () => lessonApi.getAllFlat() });
  const { data: allUnitsRes } = useQuery({ queryKey: ['units-all'], queryFn: () => unitApi.getAll({}) });

  const levels = levelsRes?.data ?? [];
  const allSubjects = subjectsRes?.data ?? [];
  const allLessonsFlat = allLessonsRes?.data ?? [];
  const allUnitsFlat = allUnitsRes?.data ?? [];

  const editFilteredSubjects = useMemo(() => {
    if (!editLevelId) return [];
    const subjectIds = new Set(allLessonsFlat.filter(l => l.levelId === editLevelId).map(l => l.subjectId));
    return allSubjects.filter(s => subjectIds.has(s.id));
  }, [allSubjects, allLessonsFlat, editLevelId]);

  const editFilteredLessons = useMemo(() => {
    if (!editLevelId || !editSubjectId) return [];
    return allLessonsFlat.filter(l => l.levelId === editLevelId && l.subjectId === editSubjectId);
  }, [allLessonsFlat, editLevelId, editSubjectId]);

  const { data: editPoolRes } = useQuery({
    queryKey: ['edit-questions-pool', editLessonIds],
    queryFn: () => questionApi.getByLessonIds(editLessonIds),
    enabled: editLessonIds.length > 0,
  });
  const editQuestionPool = editPoolRes?.data ?? [];

  const generateMut = useMutation({
    mutationFn: (config: ExamConfig) => examApi.generate(config),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam', id] }); qc.invalidateQueries({ queryKey: ['exams'] }); toast({ title: t('exams.examRegenerated') }); setEditOpen(false); },
  });

  const updateMut = useMutation({
    mutationFn: () => examApi.update(id!, { name: editName, maxScore: editMaxScore, status: editStatus, levelId: editLevelId, subjectId: editSubjectId, lessonIds: editLessonIds, questionIds: editSelectedQuestions }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam', id] }); toast({ title: t('exams.examUpdated') }); setEditOpen(false); },
  });

  const addScoreMut = useMutation({
    mutationFn: () => attemptApi.addManual(id!, scoreStudentId, scoreValue),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-attempts', id] }); toast({ title: t('exams.scoreAdded') }); setScoreOpen(false); },
  });

  const getStudentName = (sid: string) => {
    const s = students.find(st => st.id === sid);
    return s ? `${s.firstname} ${s.lastname}` : sid;
  };

  const openEdit = () => {
    if (!exam) return;
    setEditName(exam.name);
    setEditMaxScore(exam.maxScore);
    setEditStatus(exam.status);
    setEditLevelId(exam.levelId);
    setEditSubjectId(exam.subjectId);
    setEditLessonIds(exam.lessonIds);
    setEditSelectedQuestions(exam.questionIds);
    setEditMode('manual');
    setEditOpen(true);
  };

  const openAddScore = () => {
    setScoreStudentId('');
    setScoreValue(0);
    setScoreOpen(true);
  };

  const handleEditLevelChange = (levelId: string) => {
    setEditLevelId(levelId);
    setEditSubjectId('');
    setEditLessonIds([]);
  };

  const handleEditSubjectChange = (subjectId: string) => {
    setEditSubjectId(subjectId);
    setEditLessonIds([]);
  };

  const toggleEditLesson = (lessonId: string) => {
    setEditLessonIds(prev => prev.includes(lessonId) ? prev.filter(x => x !== lessonId) : [...prev, lessonId]);
  };

  if (!exam) return <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>;

  const levelName = levels.find(l => l.id === exam.levelId)?.name ?? '';
  const subjectName = allSubjects.find(s => s.id === exam.subjectId)?.name ?? '';

  const editUnitsForScope = allUnitsFlat.filter(u => u.subjectId === editSubjectId && u.levelId === editLevelId).sort((a, b) => a.order - b.order);
  const editUngroupedLessons = editFilteredLessons.filter(l => !l.unitId || !editUnitsForScope.find(u => u.id === l.unitId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/exams')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{exam.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="outline">{levelName}</Badge>
              <Badge variant="secondary">{subjectName}</Badge>
              <Badge variant={exam.status === 'published' ? 'default' : 'outline'}>{exam.status === 'published' ? t('exams.published') : t('exams.draft')}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEdit}><Edit className="h-4 w-4 mr-2" /> {t('common.edit')}</Button>
          <Button variant="destructive" onClick={() => {
            if (confirm(t('exams.deleteExam'))) {
              examApi.delete(id!).then(() => { navigate('/exams'); });
            }
          }}><Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}</Button>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info"><BookOpen className="h-4 w-4 mr-1" /> {t('exams.infoQuestions')}</TabsTrigger>
          <TabsTrigger value="records"><Users className="h-4 w-4 mr-1" /> {t('exams.studentRecords')} ({attempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{questions.length}</p><p className="text-sm text-muted-foreground">{t('exams.questions')}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{exam.maxScore}</p><p className="text-sm text-muted-foreground">{t('exams.maxScore')}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{attempts.length}</p><p className="text-sm text-muted-foreground">{t('exams.attempts')}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length * 10) / 10 : '—'}</p><p className="text-sm text-muted-foreground">{t('exams.avgScore')}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">{t('exams.questions')}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{t('questions.questionText')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('questions.difficulty')}</TableHead>
                    <TableHead>{t('common.options')}</TableHead>
                    <TableHead>{t('exams.answer')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('exams.noQuestions')}</TableCell></TableRow>
                  ) : questions.map((q, i) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell className="text-foreground">{q.text}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{q.type === 'true_false' ? t('questions.trueFalse') : t('questions.multipleChoice')}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{t(`questions.${q.difficulty}`)}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{q.options.map(o => o.text).join(' | ')}</TableCell>
                      <TableCell className="font-medium text-primary">{q.options.find(o => o.id === q.correctAnswerId)?.text}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openAddScore}><Plus className="h-4 w-4 mr-2" /> {t('exams.addScore')}</Button>
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
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('exams.noRecords')}</TableCell></TableRow>
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
          <DialogHeader><DialogTitle>{t('exams.editExam')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('exams.examName')} *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.level')} *</Label>
                <Select value={editLevelId} onValueChange={handleEditLevelChange}>
                  <SelectTrigger><SelectValue placeholder={t('common.selectLevel')} /></SelectTrigger>
                  <SelectContent>
                    {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('common.subject')} *</Label>
                <Select value={editSubjectId} onValueChange={handleEditSubjectChange} disabled={!editLevelId}>
                  <SelectTrigger><SelectValue placeholder={editLevelId ? t('common.selectSubjects') : t('exams.selectLevelFirst')} /></SelectTrigger>
                  <SelectContent>
                    {editFilteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{t('exams.selectLessons')}</Label>
              <div className="border rounded-md p-3 mt-1 max-h-48 overflow-y-auto">
                {!editSubjectId ? (
                  <p className="text-sm text-muted-foreground">{t('exams.selectLevelAndSubject')}</p>
                ) : editFilteredLessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('exams.noLessonsAvailable')}</p>
                ) : (
                  <Table>
                    <TableBody>
                      {editUnitsForScope.map(unit => {
                        const unitLessons = editFilteredLessons.filter(l => l.unitId === unit.id).sort((a, b) => a.order - b.order);
                        if (unitLessons.length === 0) return null;
                        const allSel = unitLessons.every(l => editLessonIds.includes(l.id));
                        const someSel = unitLessons.some(l => editLessonIds.includes(l.id)) && !allSel;
                        return (
                          <React.Fragment key={unit.id}>
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell className="py-1.5 w-8">
                                <Checkbox checked={allSel ? true : someSel ? 'indeterminate' : false} onCheckedChange={() => {
                                  const ids = unitLessons.map(l => l.id);
                                  if (allSel) setEditLessonIds(prev => prev.filter(id => !ids.includes(id)));
                                  else setEditLessonIds(prev => [...new Set([...prev, ...ids])]);
                                }} />
                              </TableCell>
                              <TableCell className="py-1.5 font-semibold text-sm">
                                {unit.name}
                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                  ({unitLessons.filter(l => editLessonIds.includes(l.id)).length}/{unitLessons.length})
                                </span>
                              </TableCell>
                            </TableRow>
                            {unitLessons.map(l => (
                              <TableRow key={l.id}>
                                <TableCell className="py-1 pl-6 w-8">
                                  <Checkbox checked={editLessonIds.includes(l.id)} onCheckedChange={() => toggleEditLesson(l.id)} id={`edit-lesson-${l.id}`} />
                                </TableCell>
                                <TableCell className="py-1 pl-8 text-sm">
                                  <Label htmlFor={`edit-lesson-${l.id}`} className="cursor-pointer">{l.name}</Label>
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      {editUngroupedLessons.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="py-1 w-8">
                            <Checkbox checked={editLessonIds.includes(l.id)} onCheckedChange={() => toggleEditLesson(l.id)} id={`edit-lesson-${l.id}`} />
                          </TableCell>
                          <TableCell className="py-1 text-sm">
                            <Label htmlFor={`edit-lesson-${l.id}`} className="cursor-pointer">{l.name}</Label>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t('exams.maxScore')}</Label><Input type="number" min={1} value={editMaxScore} onChange={e => setEditMaxScore(parseInt(e.target.value) || 100)} /></div>
              <div>
                <Label>{t('common.status')}</Label>
                <Select value={editStatus} onValueChange={v => setEditStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('exams.draft')}</SelectItem>
                    <SelectItem value="published">{t('exams.published')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs value={editMode} onValueChange={v => setEditMode(v as 'manual' | 'auto')}>
              <TabsList className="w-full">
                <TabsTrigger value="auto" className="flex-1">{t('exams.autoGenerate')}</TabsTrigger>
                <TabsTrigger value="manual" className="flex-1">{t('exams.manualSelect')}</TabsTrigger>
              </TabsList>

              <TabsContent value="auto" className="space-y-3 mt-3">
                <p className="text-sm text-muted-foreground">{t('exams.questionsPerDifficulty')}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-green-600">{t('questions.easy')}</Label><Input type="number" min={0} value={editEasyCount} onChange={e => setEditEasyCount(parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-yellow-600">{t('questions.medium')}</Label><Input type="number" min={0} value={editMediumCount} onChange={e => setEditMediumCount(parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="text-red-600">{t('questions.hard')}</Label><Input type="number" min={0} value={editHardCount} onChange={e => setEditHardCount(parseInt(e.target.value) || 0)} /></div>
                </div>
                <p className="text-xs text-muted-foreground">{t('exams.totalFromPool', { total: editEasyCount + editMediumCount + editHardCount, pool: editQuestionPool.length })}</p>
              </TabsContent>

              <TabsContent value="manual" className="mt-3">
                {editLessonIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('exams.selectLessonsFirst')}</p>
                ) : editQuestionPool.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('exams.noQuestionsInLessons')}</p>
                ) : (
                  <div className="border rounded-md p-3 max-h-60 overflow-y-auto space-y-2">
                    {editQuestionPool.map(q => (
                      <div key={q.id} className="flex items-center gap-2">
                        <Checkbox checked={editSelectedQuestions.includes(q.id)} onCheckedChange={() => setEditSelectedQuestions(prev => prev.includes(q.id) ? prev.filter(x => x !== q.id) : [...prev, q.id])} id={`eq-${q.id}`} />
                        <Label htmlFor={`eq-${q.id}`} className="cursor-pointer text-sm flex-1">{q.text}</Label>
                        <Badge variant="outline" className="text-xs">{t(`questions.${q.difficulty}`)}</Badge>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">{t('exams.selected', { count: editSelectedQuestions.length })}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (editMode === 'auto') {
                const config: ExamConfig = {
                  name: editName,
                  levelId: editLevelId,
                  subjectId: editSubjectId,
                  lessonIds: editLessonIds,
                  maxScore: editMaxScore,
                  mode: 'auto',
                  easyCount: editEasyCount,
                  mediumCount: editMediumCount,
                  hardCount: editHardCount,
                };
                generateMut.mutate(config);
              } else {
                updateMut.mutate();
              }
            }} disabled={updateMut.isPending || generateMut.isPending}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Score Dialog */}
      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('exams.addStudentScore')}</DialogTitle></DialogHeader>
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
              <Input type="number" min={0} max={questions.length} value={scoreValue} onChange={e => setScoreValue(parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">{t('exams.outOfQuestions', { count: questions.length })}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addScoreMut.mutate()} disabled={addScoreMut.isPending || !scoreStudentId}>{t('exams.addScore')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
