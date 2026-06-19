import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { questionApi, lessonApi, unitApi } from '@/services/exam-api';
import { subjectApi, levelApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FilterBar } from '@/components/FilterBar';
import { Plus, Pencil, Trash2, Search, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { exportToExcel } from '@/lib/excel-utils';
import type { Question, QuestionOption, QuestionType, DifficultyLevel } from '@/types/exam';

const difficultyColors: Record<DifficultyLevel, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const emptyOption = (): QuestionOption => ({ id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '' });

export default function Questions() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const presetLessonId = searchParams.get('lessonId') || '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterLesson, setFilterLesson] = useState<string>(presetLessonId || 'all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);

  const [form, setForm] = useState<{
    text: string; lessonId: string; type: QuestionType; difficulty: DifficultyLevel;
    options: QuestionOption[]; correctAnswerId: string;
  }>({
    text: '', lessonId: presetLessonId, type: 'multiple_choice', difficulty: 'easy',
    options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
    correctAnswerId: '',
  });

  const { data: lessonsRes } = useQuery({ queryKey: ['lessons-flat'], queryFn: () => lessonApi.getAllFlat() });
  const { data: subjectsRes } = useQuery({ queryKey: ['subjects-all'], queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }) });
  const { data: levelsRes } = useQuery({ queryKey: ['levels-all'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });
  const allLessons = lessonsRes?.data ?? [];
  const allSubjects = subjectsRes?.data ?? [];
  const allLevels = levelsRes?.data ?? [];

  const filteredLessons = useMemo(() => {
    let items = allLessons;
    if (filterSubject !== 'all') items = items.filter(l => l.subjectId === filterSubject);
    if (filterLevel !== 'all') items = items.filter(l => l.levelId === filterLevel);
    return items;
  }, [allLessons, filterSubject, filterLevel]);

  const { data: questionsRes, isLoading } = useQuery({
    queryKey: ['questions', page, search, filterLesson, filterDifficulty, filterSubject, filterLevel],
    queryFn: () => questionApi.getAll({
      page, limit: 10, search,
      lessonId: filterLesson !== 'all' ? filterLesson : undefined,
      difficulty: filterDifficulty !== 'all' ? filterDifficulty : undefined,
    }),
  });

  const displayQuestions = useMemo(() => {
    let items = questionsRes?.data ?? [];
    if (filterSubject !== 'all') {
      const lessonIds = allLessons.filter(l => l.subjectId === filterSubject).map(l => l.id);
      items = items.filter(q => lessonIds.includes(q.lessonId));
    }
    if (filterLevel !== 'all') {
      const lessonIds = allLessons.filter(l => l.levelId === filterLevel).map(l => l.id);
      items = items.filter(q => lessonIds.includes(q.lessonId));
    }
    return items;
  }, [questionsRes?.data, filterSubject, filterLevel, allLessons]);

  const createMut = useMutation({
    mutationFn: (data: Omit<Question, 'id' | 'createdAt'>) => questionApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questions'] }); toast({ title: t('questions.questionCreated') }); setDialogOpen(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Question> }) => questionApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questions'] }); toast({ title: t('questions.questionUpdated') }); setDialogOpen(false); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => questionApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questions'] }); toast({ title: t('questions.questionDeleted') }); },
  });

  const resetForm = (type: QuestionType = 'multiple_choice') => {
    const opts = type === 'true_false'
      ? [{ id: `tf-true-${Date.now()}`, text: t('questions.true') }, { id: `tf-false-${Date.now()}`, text: t('questions.false') }]
      : [emptyOption(), emptyOption(), emptyOption(), emptyOption()];
    setForm({ text: '', lessonId: presetLessonId, type, difficulty: 'easy', options: opts, correctAnswerId: '' });
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({ text: q.text, lessonId: q.lessonId, type: q.type, difficulty: q.difficulty, options: [...q.options], correctAnswerId: q.correctAnswerId });
    setDialogOpen(true);
  };

  const handleTypeChange = (type: QuestionType) => {
    const opts = type === 'true_false'
      ? [{ id: `tf-true-${Date.now()}`, text: t('questions.true') }, { id: `tf-false-${Date.now()}`, text: t('questions.false') }]
      : [emptyOption(), emptyOption(), emptyOption(), emptyOption()];
    setForm(f => ({ ...f, type, options: opts, correctAnswerId: '' }));
  };

  const handleSubmit = () => {
    if (!form.text || !form.lessonId || !form.correctAnswerId) {
      toast({ title: t('questions.fillRequired'), variant: 'destructive' }); return;
    }
    if (form.type === 'multiple_choice' && form.options.some(o => !o.text.trim())) {
      toast({ title: t('questions.optionsMustHaveText'), variant: 'destructive' }); return;
    }
    const payload = { text: form.text, lessonId: form.lessonId, type: form.type, difficulty: form.difficulty, options: form.options, correctAnswerId: form.correctAnswerId };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const getLessonName = (id: string) => allLessons.find(l => l.id === id)?.name ?? id;

  const hasFilters = search || filterSubject !== 'all' || filterLevel !== 'all' || filterLesson !== 'all' || filterDifficulty !== 'all';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('questions.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('questions.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => {
            const cols = [
              { key: 'text' as const, label: t('questions.questionText') },
              { key: 'lessonId' as const, label: t('questions.lesson'), render: (q: Question) => getLessonName(q.lessonId) },
              { key: 'type' as const, label: t('common.type') },
              { key: 'difficulty' as const, label: t('questions.difficulty') },
              { key: 'options' as const, label: t('common.options'), render: (q: Question) => q.options.map(o => o.text).join(' | ') },
              { key: 'correctAnswerId' as const, label: t('questions.optionsCorrect'), render: (q: Question) => q.options.find(o => o.id === q.correctAnswerId)?.text ?? '' },
            ];
            exportToExcel(displayQuestions, cols, 'questions');
          }}><Download className="h-4 w-4 mr-2" />{t('common.export')}</Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" />{t('common.import')}</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {t('questions.addQuestion')}</Button>
        </div>
      </div>

      <FilterBar showClear={!!hasFilters} onClear={() => { setSearch(''); setFilterSubject('all'); setFilterLevel('all'); setFilterLesson('all'); setFilterDifficulty('all'); setPage(1); }}>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('common.search') + '...'} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterSubject} onValueChange={v => { setFilterSubject(v); setFilterLesson('all'); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('common.subject')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.allSubjects')}</SelectItem>
            {allSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={v => { setFilterLevel(v); setFilterLesson('all'); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('common.level')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.allLevels')}</SelectItem>
            {allLevels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLesson} onValueChange={v => { setFilterLesson(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('questions.lesson')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('questions.allLessons')}</SelectItem>
            {filteredLessons.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDifficulty} onValueChange={v => { setFilterDifficulty(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('questions.difficulty')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('questions.allDifficulty')}</SelectItem>
            <SelectItem value="easy">{t('questions.easy')}</SelectItem>
            <SelectItem value="medium">{t('questions.medium')}</SelectItem>
            <SelectItem value="hard">{t('questions.hard')}</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('questions.questionText')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('questions.lesson')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('common.type')}</TableHead>
                <TableHead>{t('questions.difficulty')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              ) : !displayQuestions.length ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('questions.noQuestions')}</TableCell></TableRow>
              ) : displayQuestions.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-[300px]">
                    <p className="font-medium text-foreground truncate">{q.text}</p>
                    <p className="text-xs text-muted-foreground">{q.options.length} {t('common.options').toLowerCase()}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant="secondary">{getLessonName(q.lessonId)}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant="outline">{q.type === 'true_false' ? t('questions.trueFalse') : t('questions.multipleChoice')}</Badge></TableCell>
                  <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${difficultyColors[q.difficulty]}`}>{t(`questions.${q.difficulty}`)}</span></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {questionsRes && questionsRes.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4 pb-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('common.previous')}</Button>
              <span className="text-sm text-muted-foreground self-center">{t('common.page')} {page} {t('common.of')} {questionsRes.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= questionsRes.totalPages} onClick={() => setPage(p => p + 1)}>{t('common.next')}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        expectedColumns={['Question', 'Lesson', 'Type (true_false/multiple_choice)', 'Difficulty (easy/medium/hard)', 'Options (pipe separated)', 'Correct Answer']}
        onImport={(rows) => {
          let count = 0;
          rows.forEach(row => {
            const text = row['Question'] || row['question'] || '';
            if (!text) return;
            const lessonName = row['Lesson'] || row['lesson'] || '';
            const lesson = allLessons.find(l => l.name.toLowerCase() === lessonName.toLowerCase());
            if (!lesson) return;
            const type = (row['Type'] || row['type'] || 'multiple_choice') as QuestionType;
            const difficulty = (row['Difficulty'] || row['difficulty'] || 'easy') as DifficultyLevel;
            const optTexts = (row['Options'] || row['options'] || '').split('|').map((s: string) => s.trim()).filter(Boolean);
            const correctText = row['Correct Answer'] || row['correct answer'] || '';
            const options: QuestionOption[] = type === 'true_false'
              ? [{ id: `tf-t-${Date.now()}-${count}`, text: t('questions.true') }, { id: `tf-f-${Date.now()}-${count}`, text: t('questions.false') }]
              : optTexts.map((t: string, i: number) => ({ id: `imp-${Date.now()}-${count}-${i}`, text: t }));
            const correctOpt = options.find(o => o.text.toLowerCase() === correctText.toLowerCase());
            createMut.mutate({
              text, lessonId: lesson.id, type, difficulty, options,
              correctAnswerId: correctOpt?.id || options[0]?.id || '',
            });
            count++;
          });
          toast({ title: t('common.imported', { count, entity: t('questions.title').toLowerCase() }) });
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('questions.editQuestion') : t('questions.addQuestion')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('questions.lesson')} *</Label>
              <Select value={form.lessonId} onValueChange={v => setForm(f => ({ ...f, lessonId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('questions.selectLesson')} /></SelectTrigger>
                <SelectContent>{allLessons.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('questions.questionText')} *</Label>
              <Input value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder={t('questions.enterQuestion')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.type')}</Label>
                <Select value={form.type} onValueChange={(v: QuestionType) => handleTypeChange(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true_false">{t('questions.trueFalse')}</SelectItem>
                    <SelectItem value="multiple_choice">{t('questions.multipleChoice')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('questions.difficulty')}</Label>
                <Select value={form.difficulty} onValueChange={(v: DifficultyLevel) => setForm(f => ({ ...f, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{t('questions.easy')}</SelectItem>
                    <SelectItem value="medium">{t('questions.medium')}</SelectItem>
                    <SelectItem value="hard">{t('questions.hard')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('questions.optionsCorrect')} *</Label>
              <RadioGroup value={form.correctAnswerId} onValueChange={v => setForm(f => ({ ...f, correctAnswerId: v }))} className="mt-2 space-y-2">
                {form.options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <RadioGroupItem value={opt.id} id={opt.id} />
                    {form.type === 'true_false' ? (
                      <Label htmlFor={opt.id} className="cursor-pointer">{opt.text}</Label>
                    ) : (
                      <Input
                        value={opt.text}
                        onChange={e => setForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) }))}
                        placeholder={`${t('common.options')} ${i + 1}`}
                        className="flex-1"
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
