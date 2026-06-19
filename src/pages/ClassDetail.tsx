import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, UserX, Clock, BarChart3 } from 'lucide-react';
import { classApi, studentApi } from '@/services/api';
import { APP_CONFIG } from '@/config';
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
import type { Manager } from '@/types';

const STUDENTS_LIMIT = 20;
const STUDENTS_SELECT_LIMIT = 100;

export default function ClassDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [studentsPage, setStudentsPage] = useState(1);

  const { data: classRes, isLoading } = useQuery({
    queryKey: ['class', id],
    queryFn: () => classApi.getById(id!),
    enabled: !!id,
  });

  const { data: studentsRes, isLoading: studentsLoading } = useQuery({
    queryKey: ['class-students', id, studentsPage],
    queryFn: () => studentApi.getAll({ classId: id!, page: studentsPage, limit: STUDENTS_LIMIT }),
    enabled: !!id,
  });

  const { data: studentsSelectRes } = useQuery({
    queryKey: ['class-students-select', id],
    queryFn: () => studentApi.select({ classId: id!, page: 1, limit: STUDENTS_SELECT_LIMIT }),
    enabled: !!id,
  });

  const cls = classRes?.data;
  const classStudents = studentsRes?.data ?? [];
  const studentsTotal = studentsRes?.total ?? 0;
  const studentsForAttendance = useMemo(
    () =>
      (studentsSelectRes?.data ?? []).map((s) => ({
        id: s.id,
        firstname: s.firstname,
        lastname: s.lastname,
      })),
    [studentsSelectRes?.data],
  );

  const classManagers: Pick<Manager, 'id' | 'firstname' | 'lastname'>[] = useMemo(
    () => (cls?.managers ?? []).map((m) => ({ id: m.id, firstname: m.firstname, lastname: m.lastname })),
    [cls?.managers],
  );

  const levelName = cls?.level?.name ?? cls?.levelId ?? '';

  const subtitleParts = [cls?.section ? t('common.sectionOf', { section: cls.section }) : null, levelName].filter(
    Boolean,
  ) as string[];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('classes.notFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/classes')}>
          {t('common.backTo', { entity: t('nav.classes') })}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/classes')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{cls.name}</h1>
          <p className="text-muted-foreground">{subtitleParts.join(' · ')}</p>
        </div>
      </div>

      <Tabs defaultValue="information">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="information">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="absences" className="gap-2">
            <UserX className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tabs.absences')}</span>
          </TabsTrigger>
          <TabsTrigger value="lates" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tabs.lates')}</span>
          </TabsTrigger>
          <TabsTrigger value="marks" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tabs.markStats')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="information">
          <Card>
            <CardHeader>
              <CardTitle>{t('classes.classInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`grid grid-cols-2 gap-4 ${cls.section || APP_CONFIG.USE_MOCK_API ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.name')}</p>
                  <p className="font-medium">{cls.name}</p>
                </div>
                {(cls.section || APP_CONFIG.USE_MOCK_API) && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('common.section')}</p>
                    <p className="font-medium">{cls.section ?? '—'}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.level')}</p>
                  <p className="font-medium">{levelName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.capacity')}</p>
                  <p className="font-medium">{cls.capacity}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">{t('common.statistics')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold">{studentsTotal}</p>
                      <p className="text-xs text-muted-foreground">{t('common.students')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold">{cls.capacity}</p>
                      <p className="text-xs text-muted-foreground">{t('common.capacity')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold">{classManagers.length}</p>
                      <p className="text-xs text-muted-foreground">{t('common.managers')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold">
                        <Badge variant={studentsTotal >= cls.capacity ? 'destructive' : 'secondary'}>
                          {studentsTotal}/{cls.capacity}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">{t('common.enrollment')}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">{t('common.students')}</p>
                {studentsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : classStudents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">{t('students.noStudents')}</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('common.name')}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t('common.created')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classStudents.map((s) => (
                            <TableRow
                              key={s.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => navigate(`/students/${s.id}`)}
                            >
                              <TableCell className="font-medium">
                                {s.firstname} {s.lastname}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Pagination
                      page={studentsPage}
                      totalPages={studentsRes?.totalPages ?? 1}
                      total={studentsTotal}
                      onPageChange={setStudentsPage}
                      disabled={studentsLoading}
                    />
                  </>
                )}
              </div>

              {classManagers.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">{t('common.managers')}</p>
                  <div className="flex flex-wrap gap-2">
                    {classManagers.map((m) => (
                      <Badge
                        key={m.id}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => navigate(`/managers/${m.id}`)}
                      >
                        {m.firstname} {m.lastname}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="absences">
          <GroupAttendanceTab
            classId={id!}
            students={studentsForAttendance}
            recordType="absences"
            title={cls.name}
          />
        </TabsContent>

        <TabsContent value="lates">
          <GroupAttendanceTab
            classId={id!}
            students={studentsForAttendance}
            recordType="lates"
            title={cls.name}
          />
        </TabsContent>

        <TabsContent value="marks">
          <MarkStatisticsPanel
            fixedLevelId={cls.levelId}
            fixedClassId={cls.id}
            showFilters={true}
            title={`${t('marks.statistics')} — ${cls.name}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
