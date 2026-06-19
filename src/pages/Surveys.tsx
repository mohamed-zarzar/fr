import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { surveyApi } from '@/services/survey-api';
import { classApi, levelApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Trash2, Eye, Edit, GripVertical, ListChecks, Type,
  Star, Columns2, Search, Link2, Smartphone, AlertTriangle, Info, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Survey, SurveyQuestion, SurveyQuestionType, SurveyNote, SurveyOption, NoteColor, NotePosition, SurveyTargetType, SurveyDistribution } from '@/types/survey';

// ─── Sortable question item ─────────────────────────────────
function SortableQuestionItem({ question, onRemove, onUpdate, t }: {
  question: SurveyQuestion;
  onRemove: () => void;
  onUpdate: (q: SurveyQuestion) => void;
  t: (k: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const typeIcons: Record<SurveyQuestionType, React.ReactNode> = {
    multiple_choice: <ListChecks className="h-4 w-4 text-primary" />,
    text: <Type className="h-4 w-4 text-primary" />,
    rating: <Star className="h-4 w-4 text-primary" />,
    pros_cons: <Columns2 className="h-4 w-4 text-primary" />,
  };

  const typeLabels: Record<SurveyQuestionType, string> = {
    multiple_choice: t('surveys.multipleChoice'),
    text: t('surveys.textResponse'),
    rating: t('surveys.ratingOutOfTen'),
    pros_cons: t('surveys.prosCons'),
  };

  const addOption = () => {
    const opts = question.options || [];
    onUpdate({ ...question, options: [...opts, { id: `opt-${Date.now()}`, text: '' }] });
  };

  const updateOption = (idx: number, text: string) => {
    const opts = [...(question.options || [])];
    opts[idx] = { ...opts[idx], text };
    onUpdate({ ...question, options: opts });
  };

  const removeOption = (idx: number) => {
    const opts = (question.options || []).filter((_, i) => i !== idx);
    onUpdate({ ...question, options: opts });
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-3 bg-card space-y-2">
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-1.5">
          {typeIcons[question.type]}
          <Badge variant="outline" className="text-xs">{typeLabels[question.type]}</Badge>
        </div>
        <span className="text-xs text-muted-foreground ms-auto">#{question.order}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      <Input
        value={question.text}
        onChange={e => onUpdate({ ...question, text: e.target.value })}
        placeholder={t('surveys.questionPlaceholder')}
        className="text-sm"
      />

      {question.type === 'multiple_choice' && (
        <div className="space-y-1.5 ps-6">
          {(question.options || []).map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5">{String.fromCharCode(65 + idx)}.</span>
              <Input
                value={opt.text}
                onChange={e => updateOption(idx, e.target.value)}
                placeholder={`${t('surveys.option')} ${idx + 1}`}
                className="text-sm h-8 flex-1"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOption(idx)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={addOption}>
            <Plus className="h-3 w-3 me-1" />{t('surveys.addOption')}
          </Button>
        </div>
      )}

      {question.type === 'rating' && (
        <p className="text-xs text-muted-foreground ps-6">{t('surveys.ratingHint')}</p>
      )}
      {question.type === 'pros_cons' && (
        <p className="text-xs text-muted-foreground ps-6">{t('surveys.prosConsHint')}</p>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────
export default function Surveys() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formTargetType, setFormTargetType] = useState<SurveyTargetType>('class');
  const [formTargetIds, setFormTargetIds] = useState<string[]>([]);
  const [formDistribution, setFormDistribution] = useState<SurveyDistribution>('student_app');
  const [formQuestions, setFormQuestions] = useState<SurveyQuestion[]>([]);
  const [formNotes, setFormNotes] = useState<SurveyNote[]>([]);
  const [formStatus, setFormStatus] = useState<'draft' | 'active'>('draft');

  // Note form
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<NoteColor>('info');
  const [notePosition, setNotePosition] = useState<NotePosition>('beginning');

  const { data: surveysRes, isLoading } = useQuery({
    queryKey: ['surveys', search],
    queryFn: () => surveyApi.getAll({ search }),
  });
  const { data: classesRes } = useQuery({ queryKey: ['classes-all'], queryFn: () => classApi.getAll({ page: 1, limit: 100 }) });
  const { data: levelsRes } = useQuery({ queryKey: ['levels-all'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });

  const surveysList = surveysRes?.data || [];
  const classes = classesRes?.data || [];
  const levels = levelsRes?.data || [];

  const createMut = useMutation({
    mutationFn: (data: Omit<Survey, 'id' | 'createdAt' | 'responsesCount'>) => surveyApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      setDialogOpen(false);
      toast.success(t('surveys.surveyCreated'));
      navigate(`/surveys/${res.data.id}`);
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Survey> }) => surveyApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['surveys'] }); setDialogOpen(false); toast.success(t('surveys.surveyUpdated')); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => surveyApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['surveys'] }); setDeleteId(null); toast.success(t('surveys.surveyDeleted')); },
  });

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFormQuestions(prev => {
      const oldIndex = prev.findIndex(q => q.id === active.id);
      const newIndex = prev.findIndex(q => q.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((q, i) => ({ ...q, order: i + 1 }));
    });
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormTargetType('class');
    setFormTargetIds([]);
    setFormDistribution('student_app');
    setFormQuestions([]);
    setFormNotes([]);
    setFormStatus('draft');
    setDialogOpen(true);
  };

  const openEdit = (survey: Survey) => {
    setEditingId(survey.id);
    setFormTitle(survey.title);
    setFormTargetType(survey.targetType);
    setFormTargetIds(survey.targetIds);
    setFormDistribution(survey.distribution);
    setFormQuestions([...survey.questions]);
    setFormNotes([...survey.notes]);
    setFormStatus(survey.status === 'closed' ? 'draft' : survey.status);
    setDialogOpen(true);
  };

  const addQuestion = (type: SurveyQuestionType) => {
    const newQ: SurveyQuestion = {
      id: `sq-${Date.now()}`,
      type,
      text: '',
      order: formQuestions.length + 1,
      ...(type === 'multiple_choice' ? { options: [{ id: `opt-${Date.now()}-1`, text: '' }, { id: `opt-${Date.now()}-2`, text: '' }] } : {}),
    };
    setFormQuestions(prev => [...prev, newQ]);
  };

  const removeQuestion = (id: string) => {
    setFormQuestions(prev => prev.filter(q => q.id !== id).map((q, i) => ({ ...q, order: i + 1 })));
  };

  const updateQuestion = (updated: SurveyQuestion) => {
    setFormQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const n: SurveyNote = { id: `sn-${Date.now()}`, text: noteText, color: noteColor, position: notePosition };
    setFormNotes(prev => [...prev, n]);
    setNoteText('');
  };

  const removeNote = (id: string) => {
    setFormNotes(prev => prev.filter(n => n.id !== id));
  };

  const toggleTarget = (id: string) => {
    setFormTargetIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    if (!formTitle.trim()) { toast.error(t('surveys.titleRequired')); return; }
    if (formQuestions.length === 0) { toast.error(t('surveys.addAtLeastOneQuestion')); return; }
    if (formTargetIds.length === 0) { toast.error(t('surveys.selectTarget')); return; }

    const payload = {
      title: formTitle,
      targetType: formTargetType,
      targetIds: formTargetIds,
      distribution: formDistribution,
      questions: formQuestions,
      notes: formNotes,
      status: formStatus as 'draft' | 'active',
    };

    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const getTargetName = (type: SurveyTargetType, id: string) => {
    if (type === 'class') return classes.find(c => c.id === id)?.name ?? id;
    return levels.find(l => l.id === id)?.name ?? id;
  };

  const statusVariant = (s: string) => s === 'active' ? 'default' : s === 'closed' ? 'destructive' : 'outline';

  const noteColorMap: Record<NoteColor, string> = {
    info: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    warn: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800',
    danger: 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
  };

  const noteIconMap: Record<NoteColor, React.ReactNode> = {
    info: <Info className="h-4 w-4" />,
    warn: <AlertTriangle className="h-4 w-4" />,
    danger: <AlertCircle className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('surveys.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('surveys.subtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="me-2 h-4 w-4" />{t('surveys.createSurvey')}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t('surveys.searchSurveys')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : surveysList.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">{t('surveys.noSurveys')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('surveys.surveyTitle')}</TableHead>
                  <TableHead>{t('surveys.target')}</TableHead>
                  <TableHead>{t('surveys.questionsCount')}</TableHead>
                  <TableHead>{t('surveys.responses')}</TableHead>
                  <TableHead>{t('surveys.distributionType')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="w-28">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveysList.map(survey => (
                  <TableRow key={survey.id}>
                    <TableCell className="font-medium text-foreground">{survey.title}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {survey.targetIds.map(tid => (
                          <Badge key={tid} variant="outline" className="text-xs">{getTargetName(survey.targetType, tid)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{survey.questions.length}</TableCell>
                    <TableCell>{survey.responsesCount}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {survey.distribution === 'link' ? <><Link2 className="h-3 w-3 me-1" />{t('surveys.link')}</> : <><Smartphone className="h-3 w-3 me-1" />{t('surveys.studentApp')}</>}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(survey.status)}>{t(`surveys.${survey.status}`)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/surveys/${survey.id}`)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(survey)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(survey.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('surveys.editSurvey') : t('surveys.createSurvey')}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">{t('surveys.basicInfo')}</TabsTrigger>
              <TabsTrigger value="questions" className="flex-1">{t('surveys.questionsTab')}</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1">{t('surveys.notesTab')}</TabsTrigger>
            </TabsList>

            {/* ─ Info Tab ─ */}
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t('surveys.surveyTitle')} *</Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder={t('surveys.titlePlaceholder')} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('surveys.targetCategory')} *</Label>
                  <Select value={formTargetType} onValueChange={(v: SurveyTargetType) => { setFormTargetType(v); setFormTargetIds([]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class">{t('surveys.byClass')}</SelectItem>
                      <SelectItem value="level">{t('surveys.byLevel')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('surveys.distributionType')} *</Label>
                  <Select value={formDistribution} onValueChange={(v: SurveyDistribution) => setFormDistribution(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link"><div className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" />{t('surveys.link')}</div></SelectItem>
                      <SelectItem value="student_app"><div className="flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" />{t('surveys.studentApp')}</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{formTargetType === 'class' ? t('surveys.selectClasses') : t('surveys.selectLevels')} *</Label>
                <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                  {(formTargetType === 'class' ? classes : levels).map(item => (
                    <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox checked={formTargetIds.includes(item.id)} onCheckedChange={() => toggleTarget(item.id)} />
                      {item.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('common.status')}</Label>
                <Select value={formStatus} onValueChange={(v: 'draft' | 'active') => setFormStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('surveys.draft')}</SelectItem>
                    <SelectItem value="active">{t('surveys.active')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* ─ Questions Tab ─ */}
            <TabsContent value="questions" className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => addQuestion('multiple_choice')}>
                  <ListChecks className="h-4 w-4 me-1" />{t('surveys.addMultipleChoice')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => addQuestion('text')}>
                  <Type className="h-4 w-4 me-1" />{t('surveys.addTextQuestion')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => addQuestion('rating')}>
                  <Star className="h-4 w-4 me-1" />{t('surveys.addRating')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => addQuestion('pros_cons')}>
                  <Columns2 className="h-4 w-4 me-1" />{t('surveys.addProsCons')}
                </Button>
              </div>

              {formQuestions.length > 0 && (
                <p className="text-xs text-muted-foreground">{t('surveys.dragToReorder')}</p>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={formQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {formQuestions.map(q => (
                      <SortableQuestionItem
                        key={q.id}
                        question={q}
                        onRemove={() => removeQuestion(q.id)}
                        onUpdate={updateQuestion}
                        t={t}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {formQuestions.length === 0 && (
                <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                  {t('surveys.noQuestionsYet')}
                </div>
              )}
            </TabsContent>

            {/* ─ Notes Tab ─ */}
            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="border rounded-lg p-4 space-y-3">
                <div className="space-y-2">
                  <Label>{t('surveys.noteText')}</Label>
                  <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder={t('surveys.notePlaceholder')} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t('surveys.noteColor')}</Label>
                    <Select value={noteColor} onValueChange={(v: NoteColor) => setNoteColor(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-blue-500" />{t('surveys.info')}</div></SelectItem>
                        <SelectItem value="warn"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-yellow-500" />{t('surveys.warn')}</div></SelectItem>
                        <SelectItem value="danger"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-red-500" />{t('surveys.danger')}</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('surveys.notePosition')}</Label>
                    <Select value={notePosition} onValueChange={(v: NotePosition) => setNotePosition(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginning">{t('surveys.beginning')}</SelectItem>
                        <SelectItem value="end">{t('surveys.end')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={addNote} disabled={!noteText.trim()}>
                  <Plus className="h-4 w-4 me-1" />{t('surveys.addNote')}
                </Button>
              </div>

              {formNotes.length > 0 && (
                <div className="space-y-2">
                  {formNotes.map(n => (
                    <div key={n.id} className={`flex items-start gap-2 border rounded-lg p-3 ${noteColorMap[n.color]}`}>
                      {noteIconMap[n.color]}
                      <div className="flex-1">
                        <p className="text-sm">{n.text}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {t('surveys.position')}: {t(`surveys.${n.position}`)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeNote(n.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editingId ? t('common.save') : t('surveys.createSurvey')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('surveys.deleteSurvey')}</AlertDialogTitle>
            <AlertDialogDescription>{t('surveys.deleteSurveyDesc')}</AlertDialogDescription>
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
