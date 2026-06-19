import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { templateApi } from '@/services/api';
import { settingsApi, type PredefinedSettings } from '@/services/settings-api';
import { markRecordApi } from '@/services/mark-record-api';
import { defaultTemplates } from '@/services/mock-data';
import type { EntityType, FieldDefinition, FieldType, EntityTemplateConfig } from '@/types';
import type { MarkRecordSettings, MarkRecordType, OfficialTemplate, OfficialTemplateColumn } from '@/types/mark-record';
import { computeColumnMax } from '@/lib/mark-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';

const BASE_FIELDS = ['firstname', 'lastname'];
const FIELD_TYPES: FieldType[] = ['text', 'date', 'select', 'multi-select', 'file', 'number', 'email', 'phone', 'textarea'];

function useAutoSave<T>(data: T, saveFn: (data: T) => void, deps: any[], delayMs = 600) {
  const initialized = useRef(false);
  const lastSaved = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const serialized = JSON.stringify(data);
    if (!initialized.current) {
      initialized.current = true;
      lastSaved.current = serialized;
      return;
    }
    if (serialized === lastSaved.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastSaved.current = serialized;
      saveFn(data);
    }, delayMs);
    return () => clearTimeout(timer.current);
  }, deps);
}

function SortableFieldCard({ field, onEdit, onDelete }: { field: FieldDefinition; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.name });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <Card ref={setNodeRef} style={style} className="shadow-none">
      <CardContent className="flex items-center gap-3 p-3">
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{field.label}</span>
            <Badge variant="secondary" className="text-xs">{field.type}</Badge>
            {field.required && <Badge variant="destructive" className="text-xs">{t('settings.required')}</Badge>}
            {!field.visible && <Badge variant="outline" className="text-xs">{t('settings.hidden')}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{field.name}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settingsTab, setSettingsTab] = useState('templates');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Tabs value={settingsTab} onValueChange={setSettingsTab}>
        <TabsList>
          <TabsTrigger value="templates">{t('settings.templates')}</TabsTrigger>
          <TabsTrigger value="predefined">{t('settings.predefinedLists')}</TabsTrigger>
          <TabsTrigger value="mark-records">{t('settings.markRecords')}</TabsTrigger>
          <TabsTrigger value="approval-defaults">{t('settings.approvalDefaults')}</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="predefined">
          <PredefinedListsTab />
        </TabsContent>

        <TabsContent value="mark-records">
          <MarkRecordSettingsTab />
        </TabsContent>

        <TabsContent value="approval-defaults">
          <ApprovalDefaultsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TemplatesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [activeEntity, setActiveEntity] = useState<EntityType>('student');
  const [localFields, setLocalFields] = useState<FieldDefinition[]>([]);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [deleteFieldName, setDeleteFieldName] = useState<string | null>(null);

  const { data: tplRes } = useQuery({ queryKey: ['templates'], queryFn: () => templateApi.get() });
  const saveMut = useMutation({
    mutationFn: (config: EntityTemplateConfig) => templateApi.update(activeEntity, config),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success(t('settings.templateSaved')); },
  });

  useEffect(() => {
    if (tplRes?.data) setLocalFields([...tplRes.data[activeEntity].fields]);
  }, [tplRes, activeEntity]);

  const doSave = useCallback(() => {
    const config = tplRes?.data?.[activeEntity];
    if (!config) return;
    saveMut.mutate({ ...config, fields: localFields });
  }, [tplRes, activeEntity, localFields]);

  useAutoSave(localFields, doSave, [localFields]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sortedFields.findIndex(f => f.name === active.id);
    const newIdx = sortedFields.findIndex(f => f.name === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newFields = [...sortedFields];
    const [moved] = newFields.splice(oldIdx, 1);
    newFields.splice(newIdx, 0, moved);
    newFields.forEach((f, i) => f.order = i + 1);
    setLocalFields(newFields);
  };

  const addField = (field: FieldDefinition) => {
    setLocalFields(prev => [...prev, { ...field, order: prev.length + 1 }]);
    setFieldDialogOpen(false);
  };

  const updateField = (name: string, updated: FieldDefinition) => {
    setLocalFields(prev => prev.map(f => f.name === name ? updated : f));
    setFieldDialogOpen(false);
  };

  const removeField = (name: string) => {
    setLocalFields(prev => prev.filter(f => f.name !== name));
    setDeleteFieldName(null);
  };

  const sortedFields = [...localFields].sort((a, b) => a.order - b.order);

  const entityKeys: EntityType[] = ['student', 'teacher', 'manager', 'parent'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('settings.configureFields')}</p>
        <Button variant="outline" onClick={() => { if (tplRes?.data) { const def = JSON.parse(JSON.stringify((defaultTemplates as any)[activeEntity].fields)); setLocalFields(def); toast.info(t('settings.resetToDefaults')); } }}>{t('settings.resetDefaults')}</Button>
      </div>

      <Tabs value={activeEntity} onValueChange={v => setActiveEntity(v as EntityType)}>
        <TabsList className="flex-wrap h-auto">
          {entityKeys.map(e => (
            <TabsTrigger key={e} value={e}>{t(`settings.${e}`)}</TabsTrigger>
          ))}
        </TabsList>

        {entityKeys.map(entity => (
          <TabsContent key={entity} value={entity} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                <GripVertical className="h-4 w-4 text-muted-foreground opacity-30" />
                <span className="font-medium text-sm">firstname</span>
                <Badge variant="secondary" className="text-xs">text</Badge>
                <Badge variant="default" className="text-xs">{t('settings.baseField')}</Badge>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                <GripVertical className="h-4 w-4 text-muted-foreground opacity-30" />
                <span className="font-medium text-sm">lastname</span>
                <Badge variant="secondary" className="text-xs">text</Badge>
                <Badge variant="default" className="text-xs">{t('settings.baseField')}</Badge>
              </div>
              <Separator />
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortedFields.map(f => f.name)} strategy={verticalListSortingStrategy}>
                  {sortedFields.map(field => (
                    <SortableFieldCard
                      key={field.name}
                      field={field}
                      onEdit={() => { setEditingField(field); setFieldDialogOpen(true); }}
                      onDelete={() => setDeleteFieldName(field.name)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            <Button variant="outline" onClick={() => { setEditingField(null); setFieldDialogOpen(true); }}><Plus className="me-2 h-4 w-4" />{t('settings.addField')}</Button>
          </TabsContent>
        ))}
      </Tabs>

      <FieldEditorDialog
        open={fieldDialogOpen}
        onOpenChange={setFieldDialogOpen}
        field={editingField}
        existingNames={localFields.map(f => f.name)}
        onSave={(field) => editingField ? updateField(editingField.name, field) : addField(field)}
      />

      <AlertDialog open={!!deleteFieldName} onOpenChange={o => !o && setDeleteFieldName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.removeField')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.removeFieldDesc', { fieldName: deleteFieldName })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeField(deleteFieldName!)}>{t('settings.remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PredefinedListsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settingsRes } = useQuery({ queryKey: ['predefined-settings'], queryFn: () => settingsApi.getPredefined() });
  const [sessions, setSessions] = useState<string[]>([]);
  const [newSession, setNewSession] = useState('');

  useEffect(() => {
    if (settingsRes?.data) setSessions([...settingsRes.data.sessions]);
  }, [settingsRes]);

  const saveMut = useMutation({
    mutationFn: (data: PredefinedSettings) => settingsApi.updatePredefined(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['predefined-settings'] }); toast.success(t('settings.predefinedSaved')); },
  });

  useAutoSave(sessions, () => {
    const current = settingsRes?.data;
    saveMut.mutate({ sessions, approvalDefaults: current?.approvalDefaults || { noteApproved: false, studentAbsenceApproved: false, studentLateApproved: false, teacherAbsenceApproved: false, teacherLateApproved: false, managerAbsenceApproved: false, managerLateApproved: false, markRecordApproved: false, officialMarkRecordApproved: false } });
  }, [sessions]);

  const addSession = () => {
    if (!newSession.trim()) return;
    if (sessions.includes(newSession.trim())) { toast.error(t('settings.sessionAlreadyExists')); return; }
    setSessions(prev => [...prev, newSession.trim()]);
    setNewSession('');
  };

  const removeSession = (idx: number) => {
    setSessions(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('settings.configurePredefined')}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('settings.sessionNumbers')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('settings.sessionDescription')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {sessions.map((session, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={session}
                  onChange={e => setSessions(prev => prev.map((s, i) => i === idx ? e.target.value : s))}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeSession(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newSession}
              onChange={e => setNewSession(e.target.value)}
              placeholder={t('settings.sessionPlaceholder')}
              onKeyDown={e => e.key === 'Enter' && addSession()}
            />
            <Button variant="outline" onClick={addSession}><Plus className="me-2 h-4 w-4" />{t('common.add')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldEditorDialog({ open, onOpenChange, field, existingNames, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; field: FieldDefinition | null; existingNames: string[]; onSave: (f: FieldDefinition) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [required, setRequired] = useState(false);
  const [visible, setVisible] = useState(true);
  const [editable, setEditable] = useState(true);
  const [placeholder, setPlaceholder] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (field) {
        setName(field.name); setLabel(field.label); setType(field.type); setRequired(field.required);
        setVisible(field.visible); setEditable(field.editable); setPlaceholder(field.placeholder || '');
        setOptions(field.options || []);
      } else {
        setName(''); setLabel(''); setType('text'); setRequired(false); setVisible(true);
        setEditable(true); setPlaceholder(''); setOptions([]);
      }
      setError('');
    }
  }, [open, field]);

  const handleSave = () => {
    if (!name.trim()) { setError(t('settings.nameRequired')); return; }
    if (!label.trim()) { setError(t('settings.labelRequired')); return; }
    if (/\s/.test(name)) { setError(t('settings.noSpaces')); return; }
    if (BASE_FIELDS.includes(name)) { setError(t('settings.cannotUseBaseName')); return; }
    if (!field && existingNames.includes(name)) { setError(t('settings.nameExists')); return; }
    if ((type === 'select' || type === 'multi-select') && options.length === 0) { setError(t('settings.addOption')); return; }

    onSave({
      name: name.trim(), label: label.trim(), type, required, visible, editable,
      placeholder: placeholder.trim(), order: field?.order || 999,
      options: (type === 'select' || type === 'multi-select') ? options : undefined,
    });
  };

  const addOption = () => setOptions(prev => [...prev, { value: '', label: '' }]);
  const updateOption = (idx: number, key: 'value' | 'label', val: string) => {
    setOptions(prev => prev.map((o, i) => i === idx ? { ...o, [key]: val } : o));
  };
  const removeOption = (idx: number) => setOptions(prev => prev.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{field ? t('settings.editField') : t('settings.addField')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.fieldName')} *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="field_name" disabled={!!field} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.displayLabel')} *</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={t('settings.displayLabel')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.fieldType')}</Label>
            <Select value={type} onValueChange={v => setType(v as FieldType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FIELD_TYPES.map(ft => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.placeholder')}</Label>
            <Input value={placeholder} onChange={e => setPlaceholder(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t('settings.required')}</Label><Switch checked={required} onCheckedChange={setRequired} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t('settings.visible')}</Label><Switch checked={visible} onCheckedChange={setVisible} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t('settings.editable')}</Label><Switch checked={editable} onCheckedChange={setEditable} />
          </div>
          {(type === 'select' || type === 'multi-select') && (
            <div className="space-y-2">
              <Label>{t('settings.options')}</Label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder={t('settings.value')} value={opt.value} onChange={e => updateOption(i, 'value', e.target.value)} className="flex-1" />
                    <Input placeholder={t('settings.label')} value={opt.label} onChange={e => updateOption(i, 'label', e.target.value)} className="flex-1" />
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeOption(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption}><Plus className="me-1 h-3 w-3" />{t('settings.addOptionBtn')}</Button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{field ? t('settings.updateField') : t('settings.addField')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MarkRecordSettingsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settingsRes } = useQuery({ queryKey: ['mark-record-settings'], queryFn: () => markRecordApi.getSettings() });
  const { data: levelsRes } = useQuery({ queryKey: ['levels'], queryFn: () => import('@/services/api').then(m => m.levelApi.getAll({ page: 1, limit: 100 })) });
  const [types, setTypes] = useState<MarkRecordType[]>([]);
  const [templates, setTemplates] = useState<OfficialTemplate[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [editTemplateOpen, setEditTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OfficialTemplate | null>(null);

  useEffect(() => {
    if (settingsRes?.data) {
      setTypes([...settingsRes.data.types]);
      setTemplates(JSON.parse(JSON.stringify(settingsRes.data.officialTemplates)));
    }
  }, [settingsRes]);

  const saveMut = useMutation({
    mutationFn: (data: MarkRecordSettings) => markRecordApi.updateSettings(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mark-record-settings'] }); toast.success(t('settings.markRecordsSaved')); },
  });

  useAutoSave({ types, templates }, () => saveMut.mutate({ types, officialTemplates: templates }), [types, templates]);

  const addType = () => {
    if (!newTypeName.trim()) return;
    if (types.some(tp => tp.name === newTypeName.trim())) { toast.error(t('settings.typeAlreadyExists')); return; }
    setTypes(prev => [...prev, { id: `mrt-${Date.now()}`, name: newTypeName.trim() }]);
    setNewTypeName('');
  };

  const removeType = (id: string) => setTypes(prev => prev.filter(tp => tp.id !== id));

  const openTemplateEditor = (tpl?: OfficialTemplate) => {
    setEditingTemplate(tpl || { id: `otpl-${Date.now()}`, name: '', levelId: '', columns: [] });
    setEditTemplateOpen(true);
  };

  const saveTemplate = (tpl: OfficialTemplate) => {
    setTemplates(prev => {
      const idx = prev.findIndex(tp => tp.id === tpl.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = tpl; return next; }
      return [...prev, tpl];
    });
    setEditTemplateOpen(false);
  };

  const removeTemplate = (id: string) => setTemplates(prev => prev.filter(tp => tp.id !== id));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('settings.configureMarkRecords')}</p>

      {/* Non-Official Types */}
      <Card>
        <CardHeader><CardTitle className="text-lg">{t('settings.nonOfficialTypes')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {types.map(tp => (
              <div key={tp.id} className="flex items-center gap-2">
                <Input value={tp.name} onChange={e => setTypes(prev => prev.map(x => x.id === tp.id ? { ...x, name: e.target.value } : x))} className="flex-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeType(tp.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder={t('settings.typePlaceholder')} onKeyDown={e => e.key === 'Enter' && addType()} />
            <Button variant="outline" onClick={addType}><Plus className="me-2 h-4 w-4" />{t('common.add')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Official Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('settings.officialTemplates')}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => openTemplateEditor()}><Plus className="me-2 h-4 w-4" />{t('settings.addTemplate')}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 && <p className="text-muted-foreground text-sm">{t('settings.noTemplates')}</p>}
          {templates.map(tpl => {
            const levelName = levelsRes?.data?.find(l => l.id === tpl.levelId)?.name || t('settings.selectLevel');
            return (
              <div key={tpl.id} className="flex items-center justify-between p-3 rounded-md border">
                <div>
                  <p className="font-medium text-sm">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.level')}: {levelName} · {tpl.columns.length} {t('settings.columns')} · {t('settings.max')}: {tpl.columns.filter(c => !c.kind || c.kind === 'input').reduce((a, c) => a + c.maxScore, 0)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTemplateEditor(tpl)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTemplate(tpl.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Template Editor Dialog */}
      <OfficialTemplateEditorDialog open={editTemplateOpen} onOpenChange={setEditTemplateOpen} template={editingTemplate} onSave={saveTemplate} levels={levelsRes?.data || []} existingTemplates={templates} />
    </div>
  );
}

function OfficialTemplateEditorDialog({ open, onOpenChange, template, onSave, levels, existingTemplates }: {
  open: boolean; onOpenChange: (o: boolean) => void; template: OfficialTemplate | null; onSave: (t: OfficialTemplate) => void; levels: any[]; existingTemplates: OfficialTemplate[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [levelId, setLevelId] = useState('');
  const [columns, setColumns] = useState<OfficialTemplateColumn[]>([]);

  useEffect(() => {
    if (open && template) {
      setName(template.name);
      setLevelId(template.levelId || '');
      setColumns(JSON.parse(JSON.stringify(template.columns)));
    }
  }, [open, template]);

  const inputColumns = columns.filter(c => !c.kind || c.kind === 'input');

  const addInputColumn = () => setColumns(prev => [...prev, {
    id: `col-${Date.now()}`,
    name: '',
    maxScore: 10,
    order: prev.length + 1,
    kind: 'input',
  }]);

  const addComputedColumn = () => setColumns(prev => [...prev, {
    id: `col-c-${Date.now()}`,
    name: '',
    maxScore: 0,
    order: prev.length + 1,
    kind: 'computed',
    formula: { op: 'sum', columnIds: [] },
  }]);

  const updateColumn = (idx: number, updates: Partial<OfficialTemplateColumn>) => {
    setColumns(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c));
  };

  const removeColumn = (idx: number) => setColumns(prev => prev.filter((_, i) => i !== idx));

  const toggleSourceColumn = (colIdx: number, sourceId: string) => {
    setColumns(prev => prev.map((c, i) => {
      if (i !== colIdx || c.kind !== 'computed') return c;
      const ids = c.formula?.columnIds ?? [];
      const next = ids.includes(sourceId) ? ids.filter(x => x !== sourceId) : [...ids, sourceId];
      return { ...c, formula: { op: c.formula?.op ?? 'sum', columnIds: next } };
    }));
  };

  const usedLevelIds = existingTemplates.filter(tp => tp.id !== template?.id).map(tp => tp.levelId);
  const availableLevels = levels.filter(l => !usedLevelIds.includes(l.id));

  const handleSave = () => {
    if (!name.trim()) { toast.error(t('settings.templateNameRequired')); return; }
    if (!levelId) { toast.error(t('settings.levelRequired')); return; }
    if (columns.length === 0) { toast.error(t('settings.addAtLeastOneColumn')); return; }
    for (const col of columns) {
      if (!col.name.trim()) { toast.error(t('settings.columnNameRequired')); return; }
      if (col.kind === 'computed') {
        if (!col.formula || col.formula.columnIds.length === 0) {
          toast.error(t('settings.computedColumnNeedsSource', { name: col.name || t('settings.columnName') }));
          return;
        }
      }
    }
    const finalCols = columns.map((c, i) => {
      if (c.kind !== 'computed') return { ...c, order: i + 1 };
      return { ...c, order: i + 1, maxScore: computeColumnMax(c, columns) };
    });
    onSave({ id: template!.id, name: name.trim(), levelId, columns: finalCols });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{template?.name ? t('settings.editTemplate') : t('settings.addTemplate')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
           <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('settings.templateName')} *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('settings.templateName')} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.level')} *</Label>
              <Select value={levelId || 'none'} onValueChange={v => setLevelId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('settings.selectLevel')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('settings.selectLevel')}</SelectItem>
                  {availableLevels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  {levelId && !availableLevels.find(l => l.id === levelId) && levels.find(l => l.id === levelId) && (
                    <SelectItem value={levelId}>{levels.find(l => l.id === levelId)?.name} ({t('settings.current')})</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.columnsLabel')}</Label>
            <div className="space-y-3">
              {columns.map((col, idx) => (
                <div key={col.id} className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Input
                      value={col.name}
                      onChange={e => updateColumn(idx, { name: e.target.value })}
                      placeholder={t('settings.columnName')}
                      className="flex-1"
                    />
                    <Select
                      value={col.kind === 'computed' ? 'computed' : 'input'}
                      onValueChange={v => {
                        if (v === 'computed') {
                          updateColumn(idx, { kind: 'computed', formula: { op: 'sum', columnIds: [] }, maxScore: 0 });
                        } else {
                          const { formula: _f, ...rest } = col;
                          updateColumn(idx, { ...rest, kind: 'input', maxScore: col.maxScore || 10 });
                        }
                      }}
                    >
                      <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="input">{t('settings.columnInput')}</SelectItem>
                        <SelectItem value="computed">{t('settings.columnComputed')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeColumn(idx)}><Trash2 className="h-4 w-4" /></Button>
                  </div>

                  {(!col.kind || col.kind === 'input') ? (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-20 shrink-0">{t('settings.maxScore')}</Label>
                      <Input type="number" value={col.maxScore} onChange={e => updateColumn(idx, { maxScore: Number(e.target.value) })} className="w-24" min={1} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-20 shrink-0">{t('settings.operation')}</Label>
                        <Select
                          value={col.formula?.op ?? 'sum'}
                          onValueChange={v => updateColumn(idx, { formula: { op: v as 'sum' | 'average', columnIds: col.formula?.columnIds ?? [] } })}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sum">{t('settings.operationSum')}</SelectItem>
                            <SelectItem value="average">{t('settings.operationAverage')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('settings.sourceColumns')}</Label>
                        {inputColumns.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t('settings.noInputColumnsAvailable')}</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {inputColumns.map(src => {
                              const selected = col.formula?.columnIds.includes(src.id) ?? false;
                              return (
                                <button
                                  key={src.id}
                                  type="button"
                                  onClick={() => toggleSourceColumn(idx, src.id)}
                                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                                >
                                  {src.name || t('settings.columnName')}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.derivedMax')}: <span className="font-mono">{computeColumnMax(col, columns)}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={addInputColumn}><Plus className="me-2 h-4 w-4" />{t('settings.addColumn')}</Button>
              <Button variant="outline" size="sm" onClick={addComputedColumn}><Plus className="me-2 h-4 w-4" />{t('settings.addComputedColumn')}</Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{t('settings.saveTemplate')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalDefaultsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settingsRes } = useQuery({ queryKey: ['predefined-settings'], queryFn: () => settingsApi.getPredefined() });
  const [defaults, setDefaults] = useState(settingsRes?.data?.approvalDefaults || {
    noteApproved: false, studentAbsenceApproved: false, studentLateApproved: false,
    teacherAbsenceApproved: false, teacherLateApproved: false,
    managerAbsenceApproved: false, managerLateApproved: false,
    markRecordApproved: false, officialMarkRecordApproved: false,
  });

  useEffect(() => {
    if (settingsRes?.data) setDefaults({ ...settingsRes.data.approvalDefaults });
  }, [settingsRes]);

  const saveMut = useMutation({
    mutationFn: (data: typeof defaults) => settingsApi.updatePredefined({ sessions: settingsRes?.data?.sessions || [], approvalDefaults: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['predefined-settings'] }); toast.success(t('settings.approvalDefaultsSaved')); },
  });

  useAutoSave(defaults, (d) => saveMut.mutate(d), [defaults]);

  const toggleKeys: { key: keyof typeof defaults; label: string }[] = [
    { key: 'noteApproved', label: t('settings.noteApproved') },
    { key: 'studentAbsenceApproved', label: t('settings.studentAbsenceApproved') },
    { key: 'studentLateApproved', label: t('settings.studentLateApproved') },
    { key: 'teacherAbsenceApproved', label: t('settings.teacherAbsenceApproved') },
    { key: 'teacherLateApproved', label: t('settings.teacherLateApproved') },
    { key: 'managerAbsenceApproved', label: t('settings.managerAbsenceApproved') },
    { key: 'managerLateApproved', label: t('settings.managerLateApproved') },
    { key: 'markRecordApproved', label: t('settings.markRecordApproved') },
    { key: 'officialMarkRecordApproved', label: t('settings.officialMarkRecordApproved') },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('settings.approvalDefaultsDesc')}</p>
      <Card>
        <CardContent className="pt-6 space-y-4">
          {toggleKeys.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm">{label}</Label>
              <Switch checked={defaults[key]} onCheckedChange={v => setDefaults(prev => ({ ...prev, [key]: v }))} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
