import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { markRecordApi } from '@/services/mark-record-api';
import { studentApi, levelApi, classApi, subjectApi } from '@/services/api';
import type { OfficialTemplate, OfficialTemplateColumn } from '@/types/mark-record';
import { computeColumnValue, computeColumnMax, getInputColumns } from '@/lib/mark-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Save, Plus, Trash2, ArrowLeft, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkRow {
  key: string; // unique key for React
  studentId: string;
  subjectId: string;
  scores: Record<string, number | ''>;
  date: string;
  notes: string;
  saved: boolean;
  existingId?: string;
}

let rowKeyCounter = 0;
const nextKey = () => `bulk-row-${++rowKeyCounter}`;

export default function BulkOfficialMarks() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const levelId = searchParams.get('levelId') || '';
  const classIds = (searchParams.get('classIds') || '').split(',').filter(Boolean);
  const subjectIds = (searchParams.get('subjectIds') || '').split(',').filter(Boolean);

  const { data: settingsRes } = useQuery({ queryKey: ['mark-record-settings'], queryFn: () => markRecordApi.getSettings() });
  const { data: studentsRes } = useQuery({ queryKey: ['students'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });
  const { data: levelsRes } = useQuery({ queryKey: ['levels'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });
  const { data: classesRes } = useQuery({ queryKey: ['classes'], queryFn: () => classApi.getAll({ page: 1, limit: 100 }) });
  const { data: subjectsRes } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }) });

  const students = studentsRes?.data || [];
  const levels = levelsRes?.data || [];
  const classes = classesRes?.data || [];
  const allSubjects = subjectsRes?.data || [];
  // Only NORMAL subjects can have direct official marks entered
  const subjects = allSubjects.filter((s) => s.type !== 'MAIN');
  const templates = settingsRes?.data?.officialTemplates || [];

  const template: OfficialTemplate | undefined = templates.find(t => t.levelId === levelId);
  const columns: OfficialTemplateColumn[] = template ? [...template.columns].sort((a, b) => a.order - b.order) : [];
  const inputColumns = template ? getInputColumns(template) : [];

  const getLevelName = (id: string) => levels.find(x => x.id === id)?.name || id;
  const getStudentName = (id: string) => { const s = students.find(x => x.id === id); return s ? `${s.firstname} ${s.lastname}` : id; };
  const getSubjectName = (id: string) => subjects.find(x => x.id === id)?.name || id;
  const getClassName = (id: string) => classes.find(x => x.id === id)?.name || id;

  const [rows, setRows] = useState<BulkRow[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize rows from URL params
  useEffect(() => {
    if (initialized || !students.length) return;
    
    const initialRows: BulkRow[] = [];
    if (classIds.length > 0 && subjectIds.length > 0) {
      // Auto-fill: one row per student × subject for selected classes
      for (const cId of classIds) {
        const classStudents = students.filter(s => s.classId === cId);
        for (const student of classStudents) {
          for (const sId of subjectIds) {
            initialRows.push({
              key: nextKey(),
              studentId: student.id,
              subjectId: sId,
              scores: {},
              date: new Date().toISOString().split('T')[0],
              notes: '',
              saved: false,
            });
          }
        }
      }
    }
    setRows(initialRows);
    setInitialized(true);

    // Load existing records for pre-filled rows
    if (initialRows.length > 0) {
      loadExistingRecords(initialRows);
    }
  }, [students, initialized]);

  const loadExistingRecords = async (rowsToCheck: BulkRow[]) => {
    const updated = [...rowsToCheck];
    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.studentId && row.subjectId) {
        const res = await markRecordApi.findOfficialRecord(row.studentId, row.subjectId);
        if (res.data) {
          updated[i] = {
            ...row,
            scores: { ...res.data.scores },
            date: res.data.date,
            notes: res.data.notes,
            existingId: res.data.id,
          };
        }
      }
    }
    setRows(updated);
  };

  const addEmptyRow = () => {
    setRows(prev => [...prev, {
      key: nextKey(),
      studentId: '',
      subjectId: '',
      scores: {},
      date: new Date().toISOString().split('T')[0],
      notes: '',
      saved: false,
    }]);
  };

  const removeRow = (key: string) => {
    setRows(prev => prev.filter(r => r.key !== key));
  };

  // Track used student+subject combos for uniqueness
  const usedCombos = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.studentId && r.subjectId) set.add(`${r.studentId}__${r.subjectId}`);
    });
    return set;
  }, [rows]);

  const updateRow = (key: string, field: string, value: any) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value, saved: false } : r));
  };

  const updateScore = (key: string, colId: string, value: string) => {
    const col = inputColumns.find(c => c.id === colId);
    if (!col) return; // don't allow editing computed columns
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      const newScores = { ...r.scores };
      if (value === '') {
        newScores[colId] = '';
      } else {
        let num = Number(value);
        if (num < 0) num = 0;
        if (col && num > col.maxScore) num = col.maxScore;
        newScores[colId] = num;
      }
      return { ...r, scores: newScores, saved: false };
    }));
  };

  // When student is selected in a row, auto-fill existing marks
  const handleStudentSelect = async (key: string, studentId: string) => {
    const row = rows.find(r => r.key === key);
    if (!row) return;
    
    // Check uniqueness
    if (studentId && row.subjectId && usedCombos.has(`${studentId}__${row.subjectId}`) && row.studentId !== studentId) {
      toast.error('This student + subject combination already exists in the table');
      return;
    }
    
    updateRow(key, 'studentId', studentId);
    
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    if (row.subjectId) {
      const res = await markRecordApi.findOfficialRecord(studentId, row.subjectId);
      if (res.data) {
        setRows(prev => prev.map(r => r.key === key ? {
          ...r,
          studentId,
          scores: { ...res.data!.scores },
          date: res.data!.date,
          notes: res.data!.notes,
          existingId: res.data!.id,
          saved: false,
        } : r));
      }
    }
  };

  const handleSubjectSelect = async (key: string, subjectId: string) => {
    const row = rows.find(r => r.key === key);
    if (!row) return;

    // Check uniqueness
    if (row.studentId && subjectId && usedCombos.has(`${row.studentId}__${subjectId}`) && row.subjectId !== subjectId) {
      toast.error('This student + subject combination already exists in the table');
      return;
    }

    updateRow(key, 'subjectId', subjectId);

    if (row.studentId) {
      const res = await markRecordApi.findOfficialRecord(row.studentId, subjectId);
      if (res.data) {
        setRows(prev => prev.map(r => r.key === key ? {
          ...r,
          subjectId,
          scores: { ...res.data!.scores },
          date: res.data!.date,
          notes: res.data!.notes,
          existingId: res.data!.id,
          saved: false,
        } : r));
      }
    }
  };

  const saveMut = useMutation({
    mutationFn: async (row: BulkRow) => {
      if (!row.studentId || !row.subjectId || !template) throw new Error('Missing data');
      const student = students.find(s => s.id === row.studentId);
      const inputIds = new Set(inputColumns.map(c => c.id));
      const cleanScores: Record<string, number> = {};
      for (const [k, v] of Object.entries(row.scores)) {
        if (inputIds.has(k) && v !== '' && v !== undefined) cleanScores[k] = Number(v);
      }
      const resolvedLevelId = levelId || student?.levelId || undefined;
      const resolvedClassId = student?.classId || undefined;
      return markRecordApi.upsertOfficial({
        studentId: row.studentId,
        subjectId: row.subjectId,
        ...(resolvedLevelId && { levelId: resolvedLevelId }),
        ...(resolvedClassId && { classId: resolvedClassId }),
        templateId: template.id,
        scores: cleanScores,
        date: row.date,
        notes: row.notes,
        isOfficial: true,
      });
    },
  });

  const saveRow = async (key: string) => {
    const row = rows.find(r => r.key === key);
    if (!row || !row.studentId || !row.subjectId) {
      toast.error('Student and Subject are required');
      return;
    }
    try {
      const res = await saveMut.mutateAsync(row);
      setRows(prev => prev.map(r => r.key === key ? { ...r, saved: true, existingId: res.data?.id } : r));
      toast.success(`Saved record for ${getStudentName(row.studentId)}`);
    } catch {
      toast.error('Failed to save');
    }
  };

  const saveAll = async () => {
    const unsaved = rows.filter(r => !r.saved && r.studentId && r.subjectId);
    if (unsaved.length === 0) { toast.info('Nothing to save'); return; }
    
    let saved = 0;
    for (const row of unsaved) {
      try {
        const res = await saveMut.mutateAsync(row);
        setRows(prev => prev.map(r => r.key === row.key ? { ...r, saved: true, existingId: res.data?.id } : r));
        saved++;
      } catch { /* continue */ }
    }
    qc.invalidateQueries({ queryKey: ['mark-records'] });
    toast.success(`Saved ${saved} of ${unsaved.length} records`);
  };

  const filteredSubjects = subjectIds.length > 0
    ? subjects.filter(s => subjectIds.includes(s.id))
    : subjects;

  // Students available for manual add (filter by level if set)
  const availableStudents = students.filter(s => {
    if (levelId) return s.levelId === levelId;
    return true;
  });

  if (!template && levelId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/mark-records')}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold">Bulk Official Marks</h1>
        </div>
        <Card><CardContent className="pt-6">
          <p className="text-destructive">No official template configured for level "{getLevelName(levelId)}". Please configure one in Settings first.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/mark-records')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">Bulk Official Marks</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              {levelId && <Badge variant="outline">Level: {getLevelName(levelId)}</Badge>}
              {classIds.length > 0 && <Badge variant="outline">Classes: {classIds.map(getClassName).join(', ')}</Badge>}
              {subjectIds.length > 0 && <Badge variant="outline">Subjects: {subjectIds.map(getSubjectName).join(', ')}</Badge>}
              {template && <Badge>Template: {template.name}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addEmptyRow}><Plus className="mr-2 h-4 w-4" />Add Row</Button>
          <Button size="sm" onClick={saveAll} disabled={saveMut.isPending}><Save className="mr-2 h-4 w-4" />Save All</Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[50px] sticky left-0 bg-background z-10">#</TableHead>
                <TableHead className="min-w-[180px]">Student</TableHead>
                <TableHead className="min-w-[150px]">Subject</TableHead>
                {columns.map(col => (
                  <TableHead key={col.id} className="min-w-[100px] text-center">
                    <div className="text-xs">{col.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {col.kind === 'computed' ? (
                        <span className="text-blue-500">auto ({col.formula?.op})</span>
                      ) : (
                        `max: ${col.maxScore}`
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="min-w-[120px]">Date</TableHead>
                <TableHead className="min-w-[120px]">Notes</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 6} className="text-center py-8 text-muted-foreground">
                    No rows yet. Click "Add Row" to add students manually.
                  </TableCell>
                </TableRow>
              ) : rows.map((row, idx) => (
                <TableRow key={row.key} className={row.saved ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                  <TableCell className="font-mono text-xs text-muted-foreground sticky left-0 bg-background z-10">{idx + 1}</TableCell>
                  <TableCell>
                    <StudentCombobox
                      students={availableStudents}
                      value={row.studentId}
                      onSelect={(id) => handleStudentSelect(row.key, id)}
                      getStudentName={getStudentName}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={row.subjectId || 'none'} onValueChange={v => handleSubjectSelect(row.key, v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select subject</SelectItem>
                        {filteredSubjects.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {columns.map(col => {
                    const isComputed = col.kind === 'computed';
                    return (
                      <TableCell key={col.id} className="p-1">
                        {isComputed ? (
                          <div className="h-8 flex items-center justify-center font-mono text-xs text-muted-foreground bg-muted rounded px-2">
                            {(() => {
                              const v = computeColumnValue(col, row.scores);
                              return v !== undefined ? v : '—';
                            })()}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            className="h-8 text-center text-xs w-full"
                            min={0}
                            max={col.maxScore}
                            value={row.scores[col.id] ?? ''}
                            onChange={e => updateScore(row.key, col.id, e.target.value)}
                          />
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="p-1">
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={row.date}
                      onChange={e => updateRow(row.key, 'date', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      className="h-8 text-xs"
                      value={row.notes}
                      placeholder="Notes"
                      onChange={e => updateRow(row.key, 'notes', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {row.saved ? (
                        <Badge variant="outline" className="text-[10px] gap-1"><Check className="h-3 w-3" />Saved</Badge>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveRow(row.key)} disabled={saveMut.isPending}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(row.key)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {rows.length} rows — {rows.filter(r => r.saved).length} saved, {rows.filter(r => !r.saved && r.studentId && r.subjectId).length} unsaved
          </p>
          <Button onClick={saveAll} disabled={saveMut.isPending}><Save className="mr-2 h-4 w-4" />Save All Unsaved</Button>
        </div>
      )}
    </div>
  );
}

// ─── Searchable Student Combobox ─────────────────────────────────
function StudentCombobox({ students, value, onSelect, getStudentName }: {
  students: any[];
  value: string;
  onSelect: (id: string) => void;
  getStudentName: (id: string) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-xs font-normal"
        >
          <span className="truncate">
            {value ? getStudentName(value) : 'Select student...'}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search student..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No student found.</CommandEmpty>
            <CommandGroup>
              {students.map(s => (
                <CommandItem
                  key={s.id}
                  value={`${s.firstname} ${s.lastname}`}
                  onSelect={() => { onSelect(s.id); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === s.id ? "opacity-100" : "opacity-0")} />
                  {s.firstname} {s.lastname}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
