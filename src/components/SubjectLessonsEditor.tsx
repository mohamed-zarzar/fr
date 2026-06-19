import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lessonApi, unitApi } from '@/services/exam-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, BookOpen, GripVertical, FolderPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineEdit } from '@/components/InlineEdit';
import type { Lesson, Unit } from '@/types/exam';
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
      type="number" min={1} value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { const n = parseInt(val); if (n && n !== value) onSave(n); setEditing(false); }}
      onKeyDown={e => {
        if (e.key === 'Enter') { const n = parseInt(val); if (n && n !== value) onSave(n); setEditing(false); }
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
  lesson: Lesson; onUpdate: (id: string, data: Partial<Lesson>) => void; onDelete: (id: string) => void; onViewQuestions: (id: string) => void;
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

function LessonOverlay({ lesson }: { lesson: Lesson }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card shadow-lg opacity-90">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <Badge variant="outline" className="shrink-0 text-xs font-mono">{lesson.order}</Badge>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{lesson.name}</p>
      </div>
    </div>
  );
}

// ── Unit Drop Zone ──
function UnitDropZone({ unit, isOver, children, onUpdateUnit, onDeleteUnit }: {
  unit: Unit; isOver: boolean; children: React.ReactNode;
  onUpdateUnit: (id: string, data: Partial<Unit>) => void; onDeleteUnit: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: unit.id });
  return (
    <div className={`rounded-xl border bg-card overflow-hidden transition-all ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
        <InlineOrderEdit value={unit.order} onSave={(v) => onUpdateUnit(unit.id, { order: v })} />
        <div className="flex-1">
          <InlineEdit value={unit.name} onSave={(val) => onUpdateUnit(unit.id, { name: val })} className="font-semibold text-sm text-foreground" />
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteUnit(unit.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>
      <div ref={setNodeRef} className="p-3 space-y-2 min-h-[48px]">
        {children}
      </div>
    </div>
  );
}

function DraggableUnit({ unit, children, onUpdateUnit, onDeleteUnit }: {
  unit: Unit; children: React.ReactNode;
  onUpdateUnit: (id: string, data: Partial<Unit>) => void; onDeleteUnit: (id: string) => void;
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
          <UnitDropZone unit={unit} isOver={false} onUpdateUnit={onUpdateUnit} onDeleteUnit={onDeleteUnit}>
            {children}
          </UnitDropZone>
        </div>
      </div>
    </div>
  );
}

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

// ── Main Component ──
interface SubjectLessonsEditorProps {
  subjectId: string;
  levelId: string;
}

export function SubjectLessonsEditor({ subjectId, levelId }: SubjectLessonsEditorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState({ name: '', description: '', unitId: '', order: 1 });
  const [unitForm, setUnitForm] = useState({ name: '', order: 1 });
  const [pendingLessonForm, setPendingLessonForm] = useState<typeof form | null>(null);

  const [containers, setContainers] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'lesson' | 'unit' | null>(null);

  const { data: lessonsRes } = useQuery({
    queryKey: ['lessons', 'subject', subjectId, levelId],
    queryFn: () => lessonApi.getBySubjectAndLevel(subjectId, levelId),
    enabled: !!subjectId && !!levelId,
    refetchOnMount: 'always',
  });
  const { data: unitsRes } = useQuery({
    queryKey: ['units', subjectId, levelId],
    queryFn: () => unitApi.getAll({ subjectId, levelId }),
    enabled: !!subjectId && !!levelId,
    refetchOnMount: 'always',
  });

  const allLessons = lessonsRes?.data ?? [];
  const allUnits = (unitsRes?.data ?? []).sort((a, b) => a.order - b.order);

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
    return allUnits.find(u => u.id === activeId.replace('unit-drag-', ''));
  }, [activeId, allUnits]);

  const findContainer = useCallback((id: string): string | undefined => {
    if (containers[id] !== undefined) return id;
    for (const [cId, ids] of Object.entries(containers)) {
      if (ids.includes(id)) return cId;
    }
    return undefined;
  }, [containers]);

  const handleDragStart = (e: DragStartEvent) => {
    const id = e.active.id as string;
    setActiveId(id);
    setDragType(id.startsWith('unit-drag-') ? 'unit' : 'lesson');
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || dragType === 'unit') return;
    const ac = findContainer(active.id as string);
    const oc = findContainer(over.id as string);
    if (!ac || !oc || ac === oc) return;
    setContainers(prev => {
      const ai = [...(prev[ac] || [])];
      const oi = [...(prev[oc] || [])];
      const aIdx = ai.indexOf(active.id as string);
      if (aIdx === -1) return prev;
      const oIdx = over.id === oc ? oi.length : oi.indexOf(over.id as string);
      ai.splice(aIdx, 1);
      oi.splice(Math.max(0, oIdx), 0, active.id as string);
      return { ...prev, [ac]: ai, [oc]: oi };
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    setDragType(null);
    if (!over) return;

    if ((active.id as string).startsWith('unit-drag-')) {
      const aId = (active.id as string).replace('unit-drag-', '');
      const oId = (over.id as string).replace('unit-drag-', '');
      if (aId !== oId) {
        const ids = allUnits.map(u => u.id);
        const oi = ids.indexOf(aId);
        const ni = ids.indexOf(oId);
        if (oi !== -1 && ni !== -1) {
          const no = [...ids];
          no.splice(oi, 1);
          no.splice(ni, 0, aId);
          reorderUnitsMut.mutate(no);
        }
      }
      return;
    }

    const ac = findContainer(active.id as string);
    const oc = findContainer(over.id as string);
    if (!ac || !oc) return;
    const lesson = allLessons.find(l => l.id === active.id);
    if (!lesson) return;

    if (ac === oc) {
      const items = containers[ac];
      const oi = items.indexOf(active.id as string);
      const ni = items.indexOf(over.id as string);
      if (oi !== ni) {
        const nItems = [...items];
        nItems.splice(oi, 1);
        nItems.splice(ni, 0, active.id as string);
        setContainers(prev => ({ ...prev, [ac]: nItems }));
        reorderLessonsMut.mutate(nItems);
      }
      return;
    }

    const newUnitId = oc === '__ungrouped__' ? '' : oc;
    const targetItems = containers[oc] || [];
    moveToUnitMut.mutate({ lessonId: lesson.id, newUnitId, targetOrder: targetItems });
  };

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
  const reorderLessonsMut = useMutation({
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
      invalidate(); toast({ title: t('lessons.unitCreated') }); setUnitDialogOpen(false);
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

  const openCreateLesson = () => {
    const maxOrder = Math.max(0, ...allLessons.map(l => l.order));
    setEditing(null);
    setForm({ name: '', description: '', unitId: allUnits[0]?.id ?? '', order: maxOrder + 1 });
    setDialogOpen(true);
  };

  const handleSubmitLesson = () => {
    if (!form.name) { toast({ title: t('lessons.nameRequired'), variant: 'destructive' }); return; }
    const data = { name: form.name, description: form.description, subjectId, levelId, unitId: form.unitId, order: form.order };
    if (editing) updateLessonMut.mutate({ id: editing.id, data });
    else createLessonMut.mutate(data);
  };

  const openCreateUnit = () => { setUnitForm({ name: '', order: allUnits.length + 1 }); setUnitDialogOpen(true); };
  const handleSubmitUnit = () => {
    if (!unitForm.name) { toast({ title: t('lessons.nameRequired'), variant: 'destructive' }); return; }
    createUnitMut.mutate({ name: unitForm.name, subjectId, levelId, order: unitForm.order });
  };

  const ungroupedLessons = (containers['__ungrouped__'] ?? []).map(id => allLessons.find(l => l.id === id)).filter(Boolean) as Lesson[];
  const unitDragIds = allUnits.map(u => `unit-drag-${u.id}`);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={openCreateUnit}><FolderPlus className="h-4 w-4 mr-2" /> {t('lessons.addUnit')}</Button>
        <Button size="sm" onClick={openCreateLesson}><Plus className="h-4 w-4 mr-2" /> {t('lessons.addLesson')}</Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={unitDragIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {allUnits.map(unit => {
              const unitLessons = (containers[unit.id] ?? []).map(id => allLessons.find(l => l.id === id)).filter(Boolean) as Lesson[];
              return (
                <DraggableUnit key={unit.id} unit={unit} onUpdateUnit={(id, data) => updateUnitMut.mutate({ id, data })} onDeleteUnit={id => deleteUnitMut.mutate(id)}>
                  <SortableContext items={containers[unit.id] ?? []} strategy={verticalListSortingStrategy}>
                    {unitLessons.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('lessons.dropHere')}</p>
                    ) : unitLessons.map(lesson => (
                      <SortableLessonItem key={lesson.id} lesson={lesson}
                        onUpdate={(id, data) => updateLessonMut.mutate({ id, data })}
                        onDelete={id => deleteLessonMut.mutate(id)}
                        onViewQuestions={id => navigate(`/questions?lessonId=${id}`)}
                        t={t}
                      />
                    ))}
                  </SortableContext>
                </DraggableUnit>
              );
            })}
          </div>
        </SortableContext>

        {ungroupedLessons.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('lessons.ungrouped')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <SortableContext items={containers['__ungrouped__'] ?? []} strategy={verticalListSortingStrategy}>
                {ungroupedLessons.map(lesson => (
                  <SortableLessonItem key={lesson.id} lesson={lesson}
                    onUpdate={(id, data) => updateLessonMut.mutate({ id, data })}
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
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">{t('lessons.noLessonsShort')}</p></CardContent></Card>
      )}

      {/* Lesson Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t('lessons.editLesson') : t('lessons.addLesson')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('common.name')} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('lessons.lessonName')} /></div>
            <div><Label>{t('common.description')}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('lessons.briefDescription')} /></div>
            <div>
              <Label>{t('lessons.addUnit').split(' ').pop()}</Label>
              <div className="flex gap-2">
                <Select value={form.unitId} onValueChange={v => setForm(f => ({ ...f, unitId: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={t('lessons.selectUnit')} /></SelectTrigger>
                  <SelectContent>{allUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => { setPendingLessonForm({ ...form }); setDialogOpen(false); openCreateUnit(); }}><FolderPlus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div><Label>{t('lessons.order')}</Label><Input type="number" min={1} value={form.order} onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 1 }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmitLesson} disabled={createLessonMut.isPending || updateLessonMut.isPending}>{editing ? t('common.edit') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Dialog */}
      <Dialog open={unitDialogOpen} onOpenChange={(open) => {
        setUnitDialogOpen(open);
        if (!open && pendingLessonForm) { setForm(pendingLessonForm); setDialogOpen(true); setPendingLessonForm(null); }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('lessons.addUnit')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('lessons.unitName')} *</Label><Input value={unitForm.name} onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))} placeholder={t('lessons.unitExample')} /></div>
            <div><Label>{t('lessons.order')}</Label><Input type="number" min={1} value={unitForm.order} onChange={e => setUnitForm(f => ({ ...f, order: parseInt(e.target.value) || 1 }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUnitDialogOpen(false);
              if (pendingLessonForm) { setForm(pendingLessonForm); setDialogOpen(true); setPendingLessonForm(null); }
            }}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmitUnit} disabled={createUnitMut.isPending}>{t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
