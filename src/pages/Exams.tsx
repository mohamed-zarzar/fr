import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { examApi, lessonApi, questionApi, unitApi } from '@/services/exam-api';
import { levelApi, subjectApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FilterBar } from '@/components/FilterBar';
import { Plus, Trash2, Play, Search, Camera, Download, Upload, Edit, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { PrintExamQuestions } from '@/components/PrintExamQuestions';
import { PrintAnswerSheet } from '@/components/PrintAnswerSheet';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { exportToExcel } from '@/lib/excel-utils';
import type { ExamConfig, Question, Exam, Unit } from '@/types/exam';

function PrintQuestionsButton({ exam }: { exam: Exam }) {
  const { data: questionsRes } = useQuery({
    queryKey: ['exam-questions-print', exam.id],
    queryFn: () => examApi.getQuestionsForExam(exam.id),
  });
  const questions = questionsRes?.data ?? [];
  if (questions.length === 0) return null;
  return <PrintExamQuestions exam={exam} questions={questions} />;
}

export default function Exams() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  const [examName, setExamName] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [maxScore, setMaxScore] = useState(100);
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  const [easyCount, setEasyCount] = useState(3);
  const [mediumCount, setMediumCount] = useState(3);
  const [hardCount, setHardCount] = useState(2);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [examStatus, setExamStatus] = useState<'draft' | 'published'>('draft');
  const [importOpen, setImportOpen] = useState(false);

  const { data: levelsRes } = useQuery({ queryKey: ['levels-all'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });
  const { data: subjectsRes } = useQuery({ queryKey: ['subjects-all'], queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }) });
  const { data: allLessonsRes } = useQuery({ queryKey: ['lessons-flat'], queryFn: () => lessonApi.getAllFlat() });
  const { data: allUnitsRes } = useQuery({ queryKey: ['units-all'], queryFn: () => unitApi.getAll({}) });

  const levels = levelsRes?.data ?? [];
  const allSubjects = subjectsRes?.data ?? [];
  const allLessonsFlat = allLessonsRes?.data ?? [];
  const allUnitsFlat = allUnitsRes?.data ?? [];

  const filteredSubjects = useMemo(() => {
    if (!selectedLevelId) return [];
    const subjectIds = new Set(allLessonsFlat.filter(l => l.levelId === selectedLevelId).map(l => l.subjectId));
    return allSubjects.filter(s => subjectIds.has(s.id));
  }, [allSubjects, allLessonsFlat, selectedLevelId]);

  const filteredLessons = useMemo(() => {
    if (!selectedLevelId || !selectedSubjectId) return [];
    return allLessonsFlat.filter(l => l.levelId === selectedLevelId && l.subjectId === selectedSubjectId);
  }, [allLessonsFlat, selectedLevelId, selectedSubjectId]);

  const { data: examsRes, isLoading } = useQuery({
    queryKey: ['exams', page, search],
    queryFn: () => examApi.getAll({ page, limit: 10, search }),
  });

  const displayExams = useMemo(() => {
    let items = examsRes?.data ?? [];
    if (filterLevel !== 'all') items = items.filter(e => e.levelId === filterLevel);
    if (filterSubject !== 'all') items = items.filter(e => e.subjectId === filterSubject);
    if (filterStatus !== 'all') items = items.filter(e => e.status === filterStatus);
    return items;
  }, [examsRes?.data, filterLevel, filterSubject, filterStatus]);

  const { data: poolRes } = useQuery({
    queryKey: ['questions-pool', selectedLessons],
    queryFn: () => questionApi.getByLessonIds(selectedLessons),
    enabled: selectedLessons.length > 0,
  });
  const questionPool = poolRes?.data ?? [];

  const generateMut = useMutation({
    mutationFn: (config: ExamConfig) => examApi.generate(config),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast({ title: t('exams.examGenerated') }); setDialogOpen(false); setEditingExamId(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<any> }) => examApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast({ title: t('exams.examUpdated') }); setDialogOpen(false); setEditingExamId(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => examApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exams'] }); toast({ title: t('exams.examDeleted') }); },
  });

  const openGenerate = () => {
    setEditingExamId(null);
    setExamName(''); setSelectedLevelId(''); setSelectedSubjectId('');
    setSelectedLessons([]); setSelectedQuestions([]);
    setMaxScore(100); setEasyCount(3); setMediumCount(3); setHardCount(2);
    setMode('auto'); setDialogOpen(true);
  };

  const openEdit = (exam: any) => {
    setEditingExamId(exam.id);
    setExamName(exam.name);
    setMaxScore(exam.maxScore);
    setExamStatus(exam.status);
    setSelectedLevelId(exam.levelId);
    setSelectedSubjectId(exam.subjectId);
    setSelectedLessons(exam.lessonIds);
    setSelectedQuestions(exam.questionIds);
    setMode('manual');
    setDialogOpen(true);
  };

  const handleLevelChange = (levelId: string) => {
    setSelectedLevelId(levelId);
    setSelectedSubjectId('');
    setSelectedLessons([]);
    setSelectedQuestions([]);
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedLessons([]);
    setSelectedQuestions([]);
  };

  const toggleLesson = (id: string) => {
    setSelectedLessons(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setSelectedQuestions([]);
  };

  const toggleQuestion = (id: string) => {
    setSelectedQuestions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerate = () => {
    if (!examName.trim()) { toast({ title: t('exams.enterExamName'), variant: 'destructive' }); return; }
    if (editingExamId) {
      updateMut.mutate({ id: editingExamId, data: { name: examName, maxScore, status: examStatus, levelId: selectedLevelId, subjectId: selectedSubjectId, lessonIds: selectedLessons } });
      return;
    }
    if (!selectedLevelId) { toast({ title: t('exams.selectLevel'), variant: 'destructive' }); return; }
    if (!selectedSubjectId) { toast({ title: t('exams.selectSubject'), variant: 'destructive' }); return; }
    if (!selectedLessons.length) { toast({ title: t('exams.selectAtLeastOneLesson'), variant: 'destructive' }); return; }
    if (mode === 'manual' && !selectedQuestions.length) { toast({ title: t('exams.selectAtLeastOneQuestion'), variant: 'destructive' }); return; }

    const config: ExamConfig = {
      name: examName,
      levelId: selectedLevelId,
      subjectId: selectedSubjectId,
      lessonIds: selectedLessons,
      maxScore,
      mode,
      ...(mode === 'auto' ? { easyCount, mediumCount, hardCount } : { questionIds: selectedQuestions }),
    };
    generateMut.mutate(config);
  };

  const getLevelName = (id: string) => levels.find(l => l.id === id)?.name ?? id;
  const getSubjectName = (id: string) => allSubjects.find(s => s.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('exams.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('exams.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" />{t('common.import')}</Button>
          <Button onClick={openGenerate}><Plus className="h-4 w-4 mr-2" /> {t('exams.generateExam')}</Button>
        </div>
      </div>

      <FilterBar showClear={filterLevel !== 'all' || filterSubject !== 'all' || filterStatus !== 'all' || !!search} onClear={() => { setFilterLevel('all'); setFilterSubject('all'); setFilterStatus('all'); setSearch(''); }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('exams.searchExams')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterLevel} onValueChange={v => { setFilterLevel(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('common.level')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.allLevels')}</SelectItem>
            {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSubject} onValueChange={v => { setFilterSubject(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('common.subject')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.allSubjects')}</SelectItem>
            {allSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.allStatus')}</SelectItem>
            <SelectItem value="draft">{t('exams.draft')}</SelectItem>
            <SelectItem value="published">{t('exams.published')}</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('exams.levelSubject')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('exams.questions')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('exams.maxScore')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
                ) : !displayExams.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('exams.noExams')}</TableCell></TableRow>
                ) : displayExams.map(exam => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium text-foreground">{exam.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">{getLevelName(exam.levelId)}</Badge>
                        <Badge variant="secondary" className="text-xs">{getSubjectName(exam.subjectId)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{exam.questionIds.length}</TableCell>
                    <TableCell className="hidden sm:table-cell">{exam.maxScore}</TableCell>
                    <TableCell><Badge variant={exam.status === 'published' ? 'default' : 'outline'}>{exam.status === 'published' ? t('exams.published') : t('exams.draft')}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/exams/${exam.id}`)} title={t('common.view')}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(exam)} title={t('common.edit')}><Edit className="h-4 w-4" /></Button>
                        <PrintQuestionsButton exam={exam} />
                        <PrintAnswerSheet />
                        <Button variant="ghost" size="icon" title={t('common.export')} onClick={async () => {
                          const res = await examApi.getQuestionsForExam(exam.id);
                          const qs = res.data;
                          const cols = [
                            { key: 'text' as const, label: t('questions.questionText') },
                            { key: 'type' as const, label: t('common.type') },
                            { key: 'difficulty' as const, label: t('questions.difficulty') },
                            { key: 'options' as const, label: t('common.options'), render: (q: Question) => q.options.map(o => o.text).join(' | ') },
                            { key: 'correctAnswerId' as const, label: t('exams.answer'), render: (q: Question) => q.options.find(o => o.id === q.correctAnswerId)?.text ?? '' },
                          ];
                          exportToExcel(qs, cols, `exam-${exam.name}`);
                        }}><Download className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/exams/${exam.id}/scan`)} title={t('exams.scanExam')}><Camera className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/exams/${exam.id}/take`)}><Play className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(exam.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExamId ? t('exams.editExam') : t('exams.generateExam')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('exams.examName')} *</Label>
              <Input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. Math Quiz - Chapter 1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t('common.level')} *</Label>
                <Select value={selectedLevelId} onValueChange={handleLevelChange}>
                  <SelectTrigger><SelectValue placeholder={t('common.selectLevel')} /></SelectTrigger>
                  <SelectContent>
                    {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('common.subject')} *</Label>
                <Select value={selectedSubjectId} onValueChange={handleSubjectChange} disabled={!selectedLevelId}>
                  <SelectTrigger><SelectValue placeholder={selectedLevelId ? t('common.selectSubjects') : t('exams.selectLevelFirst')} /></SelectTrigger>
                  <SelectContent>
                    {filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{t('exams.selectLessons')} *</Label>
              <div className="border rounded-md p-3 mt-1 max-h-48 overflow-y-auto">
                {!selectedSubjectId ? (
                  <p className="text-sm text-muted-foreground">{t('exams.selectLevelAndSubject')}</p>
                ) : filteredLessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('exams.noLessonsAvailable')}</p>
                ) : (() => {
                  const unitsForScope = allUnitsFlat.filter(u => u.subjectId === selectedSubjectId && u.levelId === selectedLevelId).sort((a, b) => a.order - b.order);
                  const ungrouped = filteredLessons.filter(l => !l.unitId || !unitsForScope.find(u => u.id === l.unitId));
                  
                  const toggleUnit = (unitLessons: typeof filteredLessons) => {
                    const ids = unitLessons.map(l => l.id);
                    const allSelected = ids.every(id => selectedLessons.includes(id));
                    if (allSelected) {
                      setSelectedLessons(prev => prev.filter(id => !ids.includes(id)));
                    } else {
                      setSelectedLessons(prev => [...new Set([...prev, ...ids])]);
                    }
                    setSelectedQuestions([]);
                  };

                  return (
                    <Table>
                      <TableBody>
                        {unitsForScope.map(unit => {
                          const unitLessons = filteredLessons.filter(l => l.unitId === unit.id).sort((a, b) => a.order - b.order);
                          if (unitLessons.length === 0) return null;
                          const allSel = unitLessons.every(l => selectedLessons.includes(l.id));
                          const someSel = unitLessons.some(l => selectedLessons.includes(l.id)) && !allSel;
                          return (
                            <React.Fragment key={unit.id}>
                              <TableRow className="bg-muted/50 font-medium">
                                <TableCell className="py-1.5 w-8">
                                  <Checkbox checked={allSel ? true : someSel ? 'indeterminate' : false} onCheckedChange={() => toggleUnit(unitLessons)} />
                                </TableCell>
                                <TableCell className="py-1.5 font-semibold text-sm">
                                  {unit.name}
                                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                                    ({unitLessons.filter(l => selectedLessons.includes(l.id)).length}/{unitLessons.length})
                                  </span>
                                </TableCell>
                              </TableRow>
                              {unitLessons.map(l => (
                                <TableRow key={l.id}>
                                  <TableCell className="py-1 pl-6 w-8">
                                    <Checkbox checked={selectedLessons.includes(l.id)} onCheckedChange={() => toggleLesson(l.id)} id={`lesson-${l.id}`} />
                                  </TableCell>
                                  <TableCell className="py-1 pl-8 text-sm">
                                    <Label htmlFor={`lesson-${l.id}`} className="cursor-pointer">{l.name}</Label>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          );
                        })}
                        {ungrouped.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="py-1 w-8">
                              <Checkbox checked={selectedLessons.includes(l.id)} onCheckedChange={() => toggleLesson(l.id)} id={`lesson-${l.id}`} />
                            </TableCell>
                            <TableCell className="py-1 text-sm">
                              <Label htmlFor={`lesson-${l.id}`} className="cursor-pointer">{l.name}</Label>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                })()}
              </div>
            </div>

            {!editingExamId && (
              <>
                <div>
                  <Label>{t('exams.maxScore')}</Label>
                  <Input type="number" value={maxScore} onChange={e => setMaxScore(+e.target.value)} />
                </div>

                <div>
                  <Label>{t('exams.mode')}</Label>
                  <Select value={mode} onValueChange={(v: 'manual' | 'auto') => setMode(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t('exams.autoGenerate')}</SelectItem>
                      <SelectItem value="manual">{t('exams.manualSelect')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mode === 'auto' ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>{t('questions.easy')}</Label><Input type="number" value={easyCount} onChange={e => setEasyCount(+e.target.value)} min={0} /></div>
                    <div><Label>{t('questions.medium')}</Label><Input type="number" value={mediumCount} onChange={e => setMediumCount(+e.target.value)} min={0} /></div>
                    <div><Label>{t('questions.hard')}</Label><Input type="number" value={hardCount} onChange={e => setHardCount(+e.target.value)} min={0} /></div>
                  </div>
                ) : (
                  <div>
                    <Label>{t('exams.questions')} ({t('exams.selected', { count: selectedQuestions.length })})</Label>
                    <div className="border rounded-md p-3 mt-1 max-h-48 overflow-y-auto space-y-1">
                      {questionPool.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('exams.selectLessonsFirst')}</p>
                      ) : questionPool.map(q => (
                        <label key={q.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                          <Checkbox checked={selectedQuestions.includes(q.id)} onCheckedChange={() => toggleQuestion(q.id)} />
                          <span className="flex-1 truncate">{q.text}</span>
                          <Badge variant="outline" className="text-xs">{t(`questions.${q.difficulty}`)}</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {editingExamId && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('exams.maxScore')}</Label>
                  <Input type="number" value={maxScore} onChange={e => setMaxScore(+e.target.value)} />
                </div>
                <div>
                  <Label>{t('common.status')}</Label>
                  <Select value={examStatus} onValueChange={(v: 'draft' | 'published') => setExamStatus(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('exams.draft')}</SelectItem>
                      <SelectItem value="published">{t('exams.published')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleGenerate} disabled={generateMut.isPending || updateMut.isPending}>
              {editingExamId ? t('common.update') : t('exams.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        expectedColumns={['Name', 'Level', 'Subject', 'Max Score']}
        onImport={(rows) => {
          rows.forEach(row => {
            const name = row['Name'] || '';
            if (!name) return;
            toast({ title: t('exams.importHint', { name }) });
          });
        }}
      />
    </div>
  );
}
