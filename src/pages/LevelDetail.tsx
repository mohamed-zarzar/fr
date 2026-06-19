import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, UserX, Clock } from 'lucide-react';
import { levelApi, classApi, teacherApi, managerApi } from '@/services/api';
import { MarkStatisticsPanel } from '@/components/MarkStatisticsPanel';
import { GroupAttendanceTab } from '@/components/GroupAttendanceTab';
import { Pagination } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import type { Teacher, SchoolClass, Manager, LevelEmbeddedSubject, LevelEmbeddedStudent } from '@/types';

const PAGE_SIZE = 10;

export default function LevelDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [classPage, setClassPage] = useState(1);

  const { data: levelRes, isLoading } = useQuery({ queryKey: ['level', id], queryFn: () => levelApi.getById(id!), enabled: !!id });
  const { data: classesRes } = useQuery({
    queryKey: ['classes', { levelId: id, page: classPage }],
    queryFn: () => classApi.getAll({ page: classPage, limit: PAGE_SIZE, levelId: id! }),
    enabled: !!id,
  });
  const { data: teachersRes } = useQuery({
    queryKey: ['teachers', { levelId: id }],
    queryFn: () => teacherApi.getAll({ page: 1, limit: 100, levelId: id! }),
    enabled: !!id,
  });
  const { data: managersRes } = useQuery({
    queryKey: ['managers', { levelId: id }],
    queryFn: () => managerApi.getAll({ page: 1, limit: 100, levelId: id! }),
    enabled: !!id,
  });

  const level = levelRes?.data;
  const allTeachers = teachersRes?.data || [];
  const allManagers = managersRes?.data || [];

  const levelClasses = classesRes?.data || [];
  const levelClassIds = levelClasses.map((c: SchoolClass) => c.id);
  const levelStudents: LevelEmbeddedStudent[] = level?.students ?? [];
  const levelSubjects: LevelEmbeddedSubject[] = level?.subjects ?? [];

  const getTeachersForSubject = (subjectId: string) => {
    return allTeachers.filter((t: Teacher) =>
      t.classAssignments.some(ca =>
        levelClassIds.includes(ca.classId) && ca.subjectIds.includes(subjectId)
      )
    );
  };

  const getClassesForTeacherSubject = (teacher: Teacher, subjectId: string) => {
    return teacher.classAssignments
      .filter(ca => levelClassIds.includes(ca.classId) && ca.subjectIds.includes(subjectId))
      .map(ca => levelClasses.find(c => c.id === ca.classId))
      .filter(Boolean) as SchoolClass[];
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!level) {
    return <div className="text-center py-12"><p className="text-muted-foreground">{t('levels.notFound')}</p><Button variant="outline" className="mt-4" onClick={() => navigate('/levels')}>{t('common.backTo', { entity: t('nav.levels') })}</Button></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/levels')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{level.name}</h1>
          <p className="text-muted-foreground">{level.description}</p>
        </div>
      </div>

      <Tabs defaultValue="information">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="information">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="subjects">{t('tabs.subjects')}</TabsTrigger>
          <TabsTrigger value="classes">{t('tabs.classes')}</TabsTrigger>
          <TabsTrigger value="absences" className="gap-2"><UserX className="h-4 w-4" />{t('tabs.absences')}</TabsTrigger>
          <TabsTrigger value="lates" className="gap-2"><Clock className="h-4 w-4" />{t('tabs.lates')}</TabsTrigger>
          <TabsTrigger value="marks" className="gap-2"><BarChart3 className="h-4 w-4" />{t('tabs.markStats')}</TabsTrigger>
        </TabsList>

        <TabsContent value="information">
          <Card>
            <CardHeader><CardTitle>{t('levels.levelInfo')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">{t('common.name')}</p><p className="font-medium">{level.name}</p></div>
                <div><p className="text-sm text-muted-foreground">{t('common.description')}</p><p className="font-medium">{level.description || '—'}</p></div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">{t('common.statistics')}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{classesRes?.total ?? 0}</p><p className="text-xs text-muted-foreground">{t('common.class')}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{levelStudents.length}</p><p className="text-xs text-muted-foreground">{t('common.students')}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{levelSubjects.length}</p><p className="text-xs text-muted-foreground">{t('nav.subjects')}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{levelClasses.reduce((sum, c) => sum + c.capacity, 0)}</p><p className="text-xs text-muted-foreground">{t('common.totalCapacity')}</p></CardContent></Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects">
          <Card>
            <CardHeader><CardTitle>{t('levels.subjectsIn', { name: level.name })}</CardTitle></CardHeader>
            <CardContent>
              {levelSubjects.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('subjects.noSubjectsAssigned')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.subject')}</TableHead>
                      <TableHead>{t('common.code')}</TableHead>
                      <TableHead>{t('common.teachersClasses')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levelSubjects.map(subject => {
                      const subjectTeachers = getTeachersForSubject(subject.id);
                      return (
                        <TableRow key={subject.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/subjects/${subject.id}`)}>
                          <TableCell className="font-medium">{subject.name}</TableCell>
                          <TableCell><Badge variant="outline">{subject.code}</Badge></TableCell>
                          <TableCell>
                            {subjectTeachers.length === 0 ? (
                              <span className="text-muted-foreground text-sm">{t('common.noTeachers')}</span>
                            ) : (
                              <div className="space-y-1">
                                {subjectTeachers.map((tea: Teacher) => {
                                  const classes = getClassesForTeacherSubject(tea, subject.id);
                                  return (
                                    <div key={tea.id} className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="secondary" className="cursor-pointer" onClick={e => { e.stopPropagation(); navigate(`/teachers/${tea.id}`); }}>
                                        {tea.firstname} {tea.lastname}
                                      </Badge>
                                      {classes.map(c => (
                                        <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes">
          <Card>
            <CardHeader><CardTitle>{t('classes.classesIn', { name: level.name })}</CardTitle></CardHeader>
            <CardContent>
              {(classesRes?.total ?? 0) === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('common.noClasses')}</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.class')}</TableHead>
                        <TableHead>{t('common.section')}</TableHead>
                        <TableHead>{t('common.capacity')}</TableHead>
                        <TableHead>{t('common.activeStudents')}</TableHead>
                        <TableHead>{t('common.managers')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levelClasses.map((cls: SchoolClass) => {
                        const activeStudents = levelStudents.filter((s) => s.classId === cls.id).length;
                        const classManagers = allManagers.filter((m: Manager) => m.classIds.includes(cls.id));
                        return (
                          <TableRow key={cls.id}>
                            <TableCell className="font-medium">{cls.name}</TableCell>
                            <TableCell>{cls.section ?? '—'}</TableCell>
                            <TableCell>{cls.capacity}</TableCell>
                            <TableCell>
                              <Badge variant={activeStudents >= cls.capacity ? 'destructive' : 'secondary'}>
                                {activeStudents} / {cls.capacity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {classManagers.length > 0 ? classManagers.map((m: Manager) => (
                                  <Badge key={m.id} variant="outline" className="cursor-pointer" onClick={() => navigate(`/managers/${m.id}`)}>
                                    {m.firstname} {m.lastname}
                                  </Badge>
                                )) : <span className="text-muted-foreground text-sm">{t('common.none')}</span>}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Pagination
                    page={classPage}
                    totalPages={classesRes?.totalPages ?? 1}
                    total={classesRes?.total ?? 0}
                    onPageChange={setClassPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="absences">
          <GroupAttendanceTab
            students={levelStudents.map(s => ({ id: s.id, firstname: s.firstname, lastname: s.lastname }))}
            recordType="absences"
            title={level.name}
          />
        </TabsContent>

        <TabsContent value="lates">
          <GroupAttendanceTab
            students={levelStudents.map(s => ({ id: s.id, firstname: s.firstname, lastname: s.lastname }))}
            recordType="lates"
            title={level.name}
          />
        </TabsContent>

        <TabsContent value="marks">
          <MarkStatisticsPanel
            fixedLevelId={id!}
            showFilters={true}
            title={`${t('marks.statistics')} — ${level.name}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
