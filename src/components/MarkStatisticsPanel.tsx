import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { markRecordApi } from '@/services/mark-record-api';
import { studentApi, levelApi, classApi, subjectApi, teacherApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  fixedLevelId?: string;
  fixedClassId?: string;
  fixedSubjectId?: string;
  fixedTeacherClassSubjects?: { classId: string; subjectIds: string[] }[];
  showFilters?: boolean;
  title?: string;
}

export function MarkStatisticsPanel({
  fixedLevelId,
  fixedClassId,
  fixedSubjectId,
  fixedTeacherClassSubjects,
  showFilters = false,
  title,
}: Props) {
  const { t } = useTranslation();
  const displayTitle = title || t('marks.officialStats');

  const [statLevel, setStatLevel] = useState(fixedLevelId || 'all');
  const [statClass, setStatClass] = useState(fixedClassId || 'all');
  const [statSubject, setStatSubject] = useState(fixedSubjectId || 'all');
  const [statTeacher, setStatTeacher] = useState('all');

  const { data: studentsRes } = useQuery({ queryKey: ['students'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });
  const { data: levelsRes } = useQuery({ queryKey: ['levels'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });
  const { data: classesRes } = useQuery({ queryKey: ['classes'], queryFn: () => classApi.getAll({ page: 1, limit: 100 }) });
  const { data: subjectsRes } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }) });
  const { data: teachersRes } = useQuery({ queryKey: ['teachers'], queryFn: () => teacherApi.getAll({ page: 1, limit: 100 }) });

  const students = studentsRes?.data || [];
  const levels = levelsRes?.data || [];
  const classes = classesRes?.data || [];
  const subjects = subjectsRes?.data || [];
  const teachers = teachersRes?.data || [];

  const effectiveLevelId = fixedLevelId || (statLevel !== 'all' ? statLevel : undefined);
  const effectiveClassId = fixedClassId || (statClass !== 'all' ? statClass : undefined);
  const effectiveSubjectId = fixedSubjectId || (statSubject !== 'all' ? statSubject : undefined);

  const teacherClassSubjects = fixedTeacherClassSubjects || (statTeacher !== 'all'
    ? teachers.find((t: any) => t.id === statTeacher)?.classAssignments || []
    : undefined);

  const expectedPairCount = useMemo(() => {
    let filteredStudents = [...students];
    if (effectiveClassId) {
      filteredStudents = filteredStudents.filter(s => s.classId === effectiveClassId);
    } else if (effectiveLevelId) {
      filteredStudents = filteredStudents.filter(s => s.levelId === effectiveLevelId);
    }
    if (teacherClassSubjects) {
      const classIds = teacherClassSubjects.map(cs => cs.classId);
      filteredStudents = filteredStudents.filter(s => classIds.includes(s.classId || ''));
    }

    let filteredSubjectIds: string[] = [];
    if (effectiveSubjectId) {
      filteredSubjectIds = [effectiveSubjectId];
    } else if (effectiveLevelId) {
      const level = levels.find(l => l.id === effectiveLevelId);
      filteredSubjectIds = level?.subjectIds || [];
    } else {
      filteredSubjectIds = subjects.map(s => s.id);
    }

    if (teacherClassSubjects) {
      const teacherSubjectIds = new Set(teacherClassSubjects.flatMap(cs => cs.subjectIds));
      filteredSubjectIds = filteredSubjectIds.filter(id => teacherSubjectIds.has(id));
    }

    return filteredStudents.length * filteredSubjectIds.length;
  }, [students, levels, subjects, effectiveLevelId, effectiveClassId, effectiveSubjectId, teacherClassSubjects]);

  const { data: statsRes } = useQuery({
    queryKey: ['mark-record-stats', effectiveLevelId, effectiveClassId, effectiveSubjectId, statTeacher, expectedPairCount],
    queryFn: () => markRecordApi.getOfficialStats({
      levelId: effectiveLevelId,
      classId: effectiveClassId,
      subjectId: effectiveSubjectId,
      teacherClassSubjects,
      expectedPairCount,
    }),
  });

  const stats = statsRes?.data;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />{displayTitle}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {!fixedLevelId && (
              <div className="space-y-1">
                <Label className="text-xs">{t('common.level')}</Label>
                <Select value={statLevel} onValueChange={v => { setStatLevel(v); setStatClass('all'); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.allLevels')}</SelectItem>
                    {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!fixedClassId && (
              <div className="space-y-1">
                <Label className="text-xs">{t('common.class')}</Label>
                <Select value={statClass} onValueChange={setStatClass}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.allClasses')}</SelectItem>
                    {classes.filter(c => !effectiveLevelId || c.levelId === effectiveLevelId).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!fixedSubjectId && (
              <div className="space-y-1">
                <Label className="text-xs">{t('common.subject')}</Label>
                <Select value={statSubject} onValueChange={setStatSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.allSubjects')}</SelectItem>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!fixedTeacherClassSubjects && (
              <div className="space-y-1">
                <Label className="text-xs">{t('common.teacher')}</Label>
                <Select value={statTeacher} onValueChange={setStatTeacher}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.allTeachers')}</SelectItem>
                    {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.firstname} {t.lastname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {stats && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-2">{t('marks.completionRate')}</p>
                <div className="flex items-center gap-3">
                  <Progress value={stats.completion.percentage} className="flex-1" />
                  <span className="text-sm font-mono">{stats.completion.percentage}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stats.completion.filled} / {stats.completion.total} {t('marks.cellsFilled')}</p>
              </CardContent>
            </Card>

            {stats.columnCompletion && stats.columnCompletion.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm font-medium mb-3">{t('marks.perColumnCompletion')}</p>
                  <div className="space-y-3">
                    {stats.columnCompletion.map(col => (
                      <div key={col.columnId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{col.columnName}</span>
                          <span className="font-mono text-xs">{col.filled}/{col.total} ({col.percentage}%)</span>
                        </div>
                        <Progress value={col.percentage} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-2">{t('marks.columnAverages')}</p>
                {stats.averages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('common.noData')}</p>
                ) : (
                  <div className="space-y-2">
                    {stats.averages.map(avg => (
                      <div key={avg.columnId} className="flex items-center justify-between text-sm">
                        <span>{avg.columnName}</span>
                        <span className="font-mono">{avg.average} / {avg.maxScore}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
