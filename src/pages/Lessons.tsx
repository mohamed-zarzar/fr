import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lessonApi, unitApi } from '@/services/exam-api';
import { levelApi, subjectApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, BookOpen, GripVertical, ArrowLeft, FolderPlus, ChevronRight, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineEdit } from '@/components/InlineEdit';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { exportToExcel } from '@/lib/excel-utils';
import type { Lesson, Unit } from '@/types/exam';
import type { Level, Subject } from '@/types';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Inline Order Edit ──
function InlineOrderEdit({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));

  useEffect(() => { setVal(String(value)); }, [value]);

  if (!editing) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 text-xs font-mono cursor-pointer hover:bg-primary/10 transition-colors"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      >
        {value}
      </Badge>
    );
  }

  return (
    <Input
      type="number"
      min={1}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => {
        const n = parseInt(val);
        if (n && n !== value) onSave(n);
        setEditing(false);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          const n = parseInt(val);
          if (n && n !== value) onSave(n);
          setEditing(false);
        }
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-14 h-6 text-xs text-center p-1"
      autoFocus
      onClick={e => e.stopPropagation()}
    />
  );
}

// ── Sortable Lesson Item ──
function SortableLessonItem({ lesson, onUpdate, onDelete, onViewQuestions, t }: {
  lesson: Lesson;
  onUpdate: (id: string, data: Partial<Lesson>) => void;
  onDelete: (id: string) => void;
  onViewQuestions: (id: string) => void;
  t: (key: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow group">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <InlineOrderEdit value={lesson.order} onSave={(v) => onUpdate(lesson.id, { order: v })} />
      <div className="flex-1 min-w-0">
        <InlineEdit value={lesson.name} onSave={(val) => onUpdate(lesson.id, { name: val })} className="font-medium text-sm text-foreground block truncate" />
        <InlineEdit value={lesson.description || ''} onSave={(val) => onUpdate(lesson.id, { description: val })} className="text-xs text-muted-foreground block truncate" placeholder={t('lessons.addDescription')} />
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewQuestions(lesson.id)}><BookOpen className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(lesson.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>
    </div>
  );
}

// ── Lesson Overlay (for DragOverlay) ──
function LessonOverlay({ lesson }: { lesson: Lesson }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card shadow-lg opacity-90">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <Badge variant="outline" className="shrink-0 text-xs font-mono">{lesson.order}</Badge>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{lesson.name}</p>
        {lesson.description && <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>}
      </div>
    </div>
  );
}

// ── Sortable Unit Container ──
function SortableUnitDropZone({ unit, isOver, children, onUpdateUnit, onDeleteUnit }: {
  unit: Unit;
  isOver: boolean;
  children: React.ReactNode;
  onUpdateUnit: (id: string, data: Partial<Unit>) => void;
  onDeleteUnit: (id: string) => void;
}) {
  const { setNodeRef: setDropRef } = useDroppable({ id: unit.id });

  return (
    <div className={`rounded-xl border bg-card overflow-hidden transition-all ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
        <InlineOrderEdit value={unit.order} onSave={(v) => onUpdateUnit(unit.id, { order: v })} />
        <div className="flex-1">
          <InlineEdit value={unit.name} onSave={(val) => onUpdateUnit(unit.id, { name: val })} className="font-semibold text-sm text-foreground" />
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteUnit(unit.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>
      <div ref={setDropRef} className="p-3 space-y-2 min-h-[48px]">
        {children}
      </div>
    </div>
  );
}

// ── Draggable Unit Wrapper ──
function DraggableUnit({ unit, children, onUpdateUnit, onDeleteUnit }: {
  unit: Unit;
  children: React.ReactNode;
  onUpdateUnit: (id: string, data: Partial<Unit>) => void;
  onDeleteUnit: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `unit-drag-${unit.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-1">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <SortableUnitDropZone unit={unit} isOver={false} onUpdateUnit={onUpdateUnit} onDeleteUnit={onDeleteUnit}>
            {children}
          </SortableUnitDropZone>
        </div>
      </div>
    </div>
  );
}

// ── Unit Overlay ──
function UnitOverlay({ unit }: { unit: Unit }) {
  return (
    <div className="rounded-xl border bg-card shadow-lg opacity-90 p-4">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <Badge className="bg-primary/10 text-primary border-0">{unit.order}</Badge>
        <span className="font-semibold text-sm">{unit.name}</span>
      </div>
    </div>
  );
}

// ── Level Selection Step ──
function LevelSelector({ levels, onSelect, t }: { levels: Level[]; onSelect: (l: Level) => void; t: (key: string) => string }) {
  const colors = ['bg-emerald-500/10 text-emerald-700 border-emerald-200', 'bg-blue-500/10 text-blue-700 border-blue-200', 'bg-red-500/10 text-red-700 border-red-200', 'bg-amber-500/10 text-amber-700 border-amber-200', 'bg-purple-500/10 text-purple-700 border-purple-200'];
  const emojis = ['🟢', '🔵', '🔴', '🟡', '🟣'];
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">{t('lessons.selectLevel')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('lessons.selectLevelDesc')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {levels.map((level, i) => (
          <button key={level.id} onClick={() => onSelect(level)}
            className={`group p-6 rounded-xl border-2 transition-all hover:shadow-lg hover:scale-[1.02] text-left ${colors[i % colors.length]}`}>
            <span className="text-3xl">{emojis[i % emojis.length]}</span>
            <h3 className="text-lg font-bold mt-3">{level.name}</h3>
            <p className="text-xs mt-1 opacity-70">{level.description || t('lessons.clickToSelect')}</p>
            <ChevronRight className="h-5 w-5 mt-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Subject Selection Step ──
function SubjectSelector({ subjects, levelName, onSelect, onBack, t }: { subjects: Subject[]; levelName: string; onSelect: (s: Subject) => void; onBack: () => void; t: (key: string) => string }) {
  const emojis = ['📘', '🧪', '🌍', '📐', '🎨', '🎵', '💻', '📖'];
  const colors = ['bg-blue-500/10 text-blue-700 border-blue-200', 'bg-green-500/10 text-green-700 border-green-200', 'bg-teal-500/10 text-teal-700 border-teal-200', 'bg-orange-500/10 text-orange-700 border-orange-200', 'bg-pink-500/10 text-pink-700 border-pink-200', 'bg-violet-500/10 text-violet-700 border-violet-200'];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('lessons.selectSubject')}</h2>
          <p className="text-sm text-muted-foreground">{t('common.level')}: <Badge variant="outline">{levelName}</Badge></p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((subject, i) => (
          <button key={subject.id} onClick={() => onSelect(subject)}
            className={`group p-6 rounded-xl border-2 transition-all hover:shadow-lg hover:scale-[1.02] text-left ${colors[i % colors.length]}`}>
            <span className="text-3xl">{emojis[i % emojis.length]}</span>
            <h3 className="text-lg font-bold mt-3">{subject.name}</h3>
            <p className="text-xs mt-1 opacity-70">{subject.code}</p>
            <ChevronRight className="h-5 w-5 mt-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Lessons Page ──
export default function Lessons() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState({ name: '', description: '', unitId: '', order: 1 });
  const [unitForm, setUnitForm] = useState({ name: '', order: 1 });
  const [pendingLessonForm, setPendingLessonForm] = useState<typeof form | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // DnD state
  const [containers, setContainers] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'lesson' | 'unit' | null>(null);
  const [originalContainer, setOriginalContainer] = useState<string | null>(null);
  const [initialContainerItems, setInitialContainerItems] = useState<Record<string, string[]>>({});

  const { data: levelsRes } = useQuery({ queryKey: ['levels-all'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });
  const { data: subjectsRes } = useQuery({ queryKey: ['subjects-all'], queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }) });
  const levels = levelsRes?.data ?? [];
  const subjects = subjectsRes?.data ?? [];

  const { data: lessonsRes } = useQuery({
    queryKey: ['lessons', selectedLevel?.id, selectedSubject?.id],
    queryFn: () => lessonApi.getBySubjectAndLevel(selectedSubject!.id, selectedLevel!.id),
    enabled: !!selectedLevel && !!selectedSubject,
    refetchOnMount: 'always',
  });

  const { data: unitsRes } = useQuery({
    queryKey: ['units', selectedLevel?.id, selectedSubject?.id],
    queryFn: () => unitApi.getAll({ subjectId: selectedSubject!.id, levelId: selectedLevel!.id }),
    enabled: !!selectedLevel && !!selectedSubject,
    refetchOnMount: 'always',
  });

  const allLessons = lessonsRes?.data ?? [];
  const allUnits = (unitsRes?.data ?? []).sort((a, b) => a.order - b.order);

  // Sync containers from server data
  useEffect(() => {
    const c: Record<string, string[]> = {};
    allUnits.forEach(u => { c[u.id] = []; });
    c['__ungrouped__'] = [];
    allLessons.forEach(l => {
      const key = l.unitId && c[l.unitId] !== undefined ? l.unitId : '__ungrouped__';
      c[key].push(l.id);
    });
    Object.values(c).forEach(arr => arr.sort((a, b) => {
      const la = allLessons.find(l => l.id === a);
      const lb = allLessons.find(l => l.id === b);
      return (la?.order ?? 0) - (lb?.order ?? 0);
    }));
    setContainers(c);
  }, [allLessons, allUnits]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeLesson = useMemo(() => activeId ? allLessons.find(l => l.id === activeId) : null, [activeId, allLessons]);
  const activeUnit = useMemo(() => {
    if (!activeId || !activeId.startsWith('unit-drag-')) return null;
    const unitId = activeId.replace('unit-drag-', '');
    return allUnits.find(u => u.id === unitId);
  }, [activeId, allUnits]);

  // ── DnD helpers ──
  const findContainer = useCallback((id: string): string | undefined => {
    if (containers[id] !== undefined) return id;
    for (const [containerId, lessonIds] of Object.entries(containers)) {
      if (lessonIds.includes(id)) return containerId;
    }
    return undefined;
  }, [containers]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    setDragType(id.startsWith('unit-drag-') ? 'unit' : 'lesson');

    if (!id.startsWith('unit-drag-')) {
      const container = findContainer(id);
      if (container) {
        setOriginalContainer(container);
        setInitialContainerItems(prev => ({
          ...prev,
          [container]: [...(containers[container] || [])]
        }));
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || dragType === 'unit') return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setContainers(prev => {
      const activeItems = [...(prev[activeContainer] || [])];
      const overItems = [...(prev[overContainer] || [])];
      const activeIndex = activeItems.indexOf(active.id as string);
      if (activeIndex === -1) return prev;

      const overIndex = over.id === overContainer ? overItems.length : overItems.indexOf(over.id as string);
      activeItems.splice(activeIndex, 1);
      overItems.splice(Math.max(0, overIndex), 0, active.id as string);
      return { ...prev, [activeContainer]: activeItems, [overContainer]: overItems };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDragType(null);
    if (!over) {
      setOriginalContainer(null);
      setInitialContainerItems({});
      return;
    }

    // Unit reordering
    if ((active.id as string).startsWith('unit-drag-')) {
      const activeUnitId = (active.id as string).replace('unit-drag-', '');
      const overUnitId = (over.id as string).replace('unit-drag-', '');
      if (activeUnitId !== overUnitId) {
        const unitIds = allUnits.map(u => u.id);
        const oldIdx = unitIds.indexOf(activeUnitId);
        const newIdx = unitIds.indexOf(overUnitId);
        if (oldIdx !== -1 && newIdx !== -1) {
          const newOrder = [...unitIds];
          newOrder.splice(oldIdx, 1);
          newOrder.splice(newIdx, 0, activeUnitId);
          reorderUnitsMut.mutate(newOrder);
        }
      }
      setOriginalContainer(null);
      setInitialContainerItems({});
      return;
    }

    // Lesson reordering
    const lesson = allLessons.find(l => l.id === active.id);
    if (!lesson) {
      setOriginalContainer(null);
      setInitialContainerItems({});
      return;
    }

    const overContainer = findContainer(over.id as string);
    if (!overContainer) {
      setOriginalContainer(null);
      setInitialContainerItems({});
      return;
    }

    // Cross‑unit move?
    if (originalContainer && originalContainer !== overContainer) {
      const targetOrder = containers[overContainer] || [];
      const newUnitId = overContainer === '__ungrouped__' ? '' : overContainer;
      moveToUnitMut.mutate({ lessonId: lesson.id, newUnitId, targetOrder });
    } else {
      // Within‑unit reorder – only call if order actually changed
      const items = containers[overContainer] || [];
      const initialItems = initialContainerItems[overContainer] || [];
      if (JSON.stringify(items) !== JSON.stringify(initialItems)) {
        reorderWithinUnitMut.mutate(items);
      }
    }

    // Clean up temporary drag state
    setOriginalContainer(null);
    setInitialContainerItems({});
  };

  // ── Mutations ──
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
    queryClient.invalidateQueries({ queryKey: ['units'] });
  };

  const createLessonMut = useMutation({
    mutationFn: (data: Omit<Lesson, 'id' | 'createdAt'>) => lessonApi.create(data),
    onSuccess: () => { invalidate(); toast({ title: t('lessons.lessonCreated') }); setDialogOpen(false); },
  });
  const updateLessonMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lesson> }) => lessonApi.update(id, data),
    onSuccess: () => { invalidate(); toast({ title: t('lessons.lessonUpdated') }); },
  });
  const deleteLessonMut = useMutation({
    mutationFn: (id: string) => lessonApi.delete(id),
    onSuccess: () => { invalidate(); toast({ title: t('lessons.lessonDeleted') }); },
  });
  const reorderWithinUnitMut = useMutation({
    mutationFn: (ids: string[]) => lessonApi.reorder(ids),
    onSuccess: () => invalidate(),
  });
  const moveToUnitMut = useMutation({
    mutationFn: ({ lessonId, newUnitId, targetOrder }: { lessonId: string; newUnitId: string; targetOrder: string[] }) =>
      lessonApi.moveToUnit(lessonId, newUnitId, targetOrder),
    onSuccess: () => { invalidate(); toast({ title: t('lessons.lessonMoved') }); },
  });
  const createUnitMut = useMutation({
    mutationFn: (data: Omit<Unit, 'id' | 'createdAt'>) => unitApi.create(data),
    onSuccess: (res) => {
      invalidate();
      toast({ title: t('lessons.unitCreated') });
      setUnitDialogOpen(false);
      if (pendingLessonForm) {
        setForm({ ...pendingLessonForm, unitId: res.data.id });
        setDialogOpen(true);
        setPendingLessonForm(null);
      }
    },
  });
  const updateUnitMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Unit> }) => unitApi.update(id, data),
    onSuccess: () => { invalidate(); toast({ title: t('lessons.unitUpdated') }); },
  });
  const deleteUnitMut = useMutation({
    mutationFn: (id: string) => unitApi.delete(id),
    onSuccess: () => { invalidate(); toast({ title: t('lessons.unitDeleted') }); },
  });
  const reorderUnitsMut = useMutation({
    mutationFn: (ids: string[]) => unitApi.reorder(ids),
    onSuccess: () => { invalidate(); toast({ title: t('lessons.unitsReordered') }); },
  });

  // ── Handlers ──
  const openCreateLesson = () => {
    const maxOrder = Math.max(0, ...allLessons.map(l => l.order));
    setEditing(null);
    setForm({ name: '', description: '', unitId: allUnits[0]?.id ?? '', order: maxOrder + 1 });
    setDialogOpen(true);
  };
  const handleSubmitLesson = () => {
    if (!form.name) { toast({ title: t('lessons.nameRequired'), variant: 'destructive' }); return; }
    const data = { name: form.name, description: form.description, subjectId: selectedSubject!.id, levelId: selectedLevel!.id, unitId: form.unitId, order: form.order };
    if (editing) updateLessonMut.mutate({ id: editing.id, data });
    else createLessonMut.mutate(data);
  };

  const openCreateUnit = () => { setUnitForm({ name: '', order: allUnits.length + 1 }); setUnitDialogOpen(true); };
  const handleSubmitUnit = () => {
    if (!unitForm.name) { toast({ title: t('lessons.nameRequired'), variant: 'destructive' }); return; }
    createUnitMut.mutate({ name: unitForm.name, subjectId: selectedSubject!.id, levelId: selectedLevel!.id, order: unitForm.order });
  };

  const handleInlineUpdateLesson = (id: string, data: Partial<Lesson>) => {
    updateLessonMut.mutate({ id, data });
  };
  const handleInlineUpdateUnit = (id: string, data: Partial<Unit>) => {
    updateUnitMut.mutate({ id, data });
  };

  // ── Step rendering ──
  if (!selectedLevel) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('lessons.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('lessons.subtitle')}</p>
        </div>
        <LevelSelector levels={levels} onSelect={setSelectedLevel} t={t} />
      </div>
    );
  }

  if (!selectedSubject) {
    const levelSubjects = selectedLevel.subjectIds?.length > 0
      ? subjects.filter(s => selectedLevel.subjectIds.includes(s.id))
      : subjects;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('lessons.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('lessons.subtitle')}</p>
        </div>
        <SubjectSelector subjects={levelSubjects} levelName={selectedLevel.name} onSelect={setSelectedSubject} onBack={() => setSelectedLevel(null)} t={t} />
      </div>
    );
  }

  // ── Full lessons view ──
  const ungroupedLessons = (containers['__ungrouped__'] ?? []).map(id => allLessons.find(l => l.id === id)).filter(Boolean) as Lesson[];
  const unitDragIds = allUnits.map(u => `unit-drag-${u.id}`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedSubject(null)}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('lessons.title')}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="cursor-pointer" onClick={() => { setSelectedLevel(null); setSelectedSubject(null); }}>{selectedLevel.name}</Badge>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedSubject(null)}>{selectedSubject.name}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => {
            const cols = [
              { key: 'name' as const, label: t('common.name') },
              { key: 'description' as const, label: t('common.description') },
              { key: 'unitId' as const, label: t('lessons.addUnit').replace(/^.*\s/, ''), render: (l: Lesson) => allUnits.find(u => u.id === l.unitId)?.name ?? '' },
              { key: 'order' as const, label: t('lessons.order') },
            ];
            exportToExcel(allLessons, cols, `lessons-${selectedLevel.name}-${selectedSubject.name}`);
          }}><Download className="h-4 w-4 mr-1" /><span className="hidden sm:inline">{t('common.export')}</span></Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /><span className="hidden sm:inline">{t('common.import')}</span></Button>
          <Button variant="outline" size="sm" onClick={openCreateUnit}><FolderPlus className="h-4 w-4 mr-1" /><span className="hidden sm:inline">{t('lessons.addUnit')}</span></Button>
          <Button size="sm" onClick={openCreateLesson}><Plus className="h-4 w-4 mr-1" /><span className="hidden sm:inline">{t('lessons.addLesson')}</span></Button>
        </div>
      </div>

      {/* Units + Lessons with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={unitDragIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {allUnits.map(unit => {
              const unitLessons = (containers[unit.id] ?? []).map(id => allLessons.find(l => l.id === id)).filter(Boolean) as Lesson[];
              return (
                <DraggableUnit key={unit.id} unit={unit} onUpdateUnit={handleInlineUpdateUnit} onDeleteUnit={id => deleteUnitMut.mutate(id)}>
                  <SortableContext items={containers[unit.id] ?? []} strategy={verticalListSortingStrategy}>
                    {unitLessons.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('lessons.dropHere')}</p>
                    ) : (
                      unitLessons.map(lesson => (
                        <SortableLessonItem
                          key={lesson.id}
                          lesson={lesson}
                          onUpdate={handleInlineUpdateLesson}
                          onDelete={id => deleteLessonMut.mutate(id)}
                          onViewQuestions={id => navigate(`/questions?lessonId=${id}`)}
                          t={t}
                        />
                      ))
                    )}
                  </SortableContext>
                </DraggableUnit>
              );
            })}
          </div>
        </SortableContext>

        {/* Ungrouped lessons */}
        {ungroupedLessons.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t('lessons.ungrouped')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SortableContext items={containers['__ungrouped__'] ?? []} strategy={verticalListSortingStrategy}>
                {ungroupedLessons.map(lesson => (
                  <SortableLessonItem
                    key={lesson.id}
                    lesson={lesson}
                    onUpdate={handleInlineUpdateLesson}
                    onDelete={id => deleteLessonMut.mutate(id)}
                    onViewQuestions={id => navigate(`/questions?lessonId=${id}`)}
                    t={t}
                  />
                ))}
              </SortableContext>
            </CardContent>
          </Card>
        )}

        <DragOverlay>
          {activeLesson && <LessonOverlay lesson={activeLesson} />}
          {activeUnit && <UnitOverlay unit={activeUnit} />}
        </DragOverlay>
      </DndContext>

      {allUnits.length === 0 && ungroupedLessons.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t('lessons.noLessons')}</p>
          </CardContent>
        </Card>
      )}

      {/* Lesson Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('lessons.editLesson') : t('lessons.addLesson')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('common.name')} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('lessons.lessonName')} /></div>
            <div><Label>{t('common.description')}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('lessons.briefDescription')} /></div>
            <div>
              <Label>{t('lessons.addUnit').split(' ').pop()}</Label>
              <div className="flex gap-2">
                <Select value={form.unitId} onValueChange={v => setForm(f => ({ ...f, unitId: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={t('lessons.selectUnit')} /></SelectTrigger>
                  <SelectContent>
                    {allUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => {
                  setPendingLessonForm({ ...form });
                  setDialogOpen(false);
                  openCreateUnit();
                }}><FolderPlus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div><Label>{t('lessons.order')}</Label><Input type="number" min={1} value={form.order} onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 1 }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmitLesson} disabled={createLessonMut.isPending || updateLessonMut.isPending}>
              {editing ? t('common.edit') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        expectedColumns={['Name', 'Description', 'Unit', 'Order']}
        onImport={(rows) => {
          let count = 0;
          rows.forEach(row => {
            const name = row['Name'] || row['name'];
            if (!name) return;
            const unitName = row['Unit'] || row['unit'] || '';
            const matchedUnit = allUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());
            const order = parseInt(row['Order'] || row['order'] || '0') || (allLessons.length + count + 1);
            createLessonMut.mutate({
              name,
              description: row['Description'] || row['description'] || '',
              subjectId: selectedSubject!.id,
              levelId: selectedLevel!.id,
              unitId: matchedUnit?.id || '',
              order,
            });
            count++;
          });
          toast({ title: t('lessons.importedCount', { count }) });
        }}
      />

      {/* Unit Dialog */}
      <Dialog open={unitDialogOpen} onOpenChange={(open) => {
        setUnitDialogOpen(open);
        if (!open && pendingLessonForm) {
          setForm(pendingLessonForm);
          setDialogOpen(true);
          setPendingLessonForm(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('lessons.addUnit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('lessons.unitName')} *</Label><Input value={unitForm.name} onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))} placeholder={t('lessons.unitExample')} /></div>
            <div><Label>{t('lessons.order')}</Label><Input type="number" min={1} value={unitForm.order} onChange={e => setUnitForm(f => ({ ...f, order: parseInt(e.target.value) || 1 }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUnitDialogOpen(false);
              if (pendingLessonForm) {
                setForm(pendingLessonForm);
                setDialogOpen(true);
                setPendingLessonForm(null);
              }
            }}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmitUnit} disabled={createUnitMut.isPending}>{t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
