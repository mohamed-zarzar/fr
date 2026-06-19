import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi, templateApi } from '@/services/api';
import { DynamicView } from '@/components/DynamicView';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { EntityAttendanceTab } from '@/components/EntityAttendanceTab';
import { StudentMarkRecordsTab } from '@/components/StudentMarkRecordsTab';
import { StudentMarkStatsTab } from '@/components/StudentMarkStatsTab';
import { StudentNotesTab } from '@/components/StudentNotesTab';
import { StudentPointsTab } from '@/components/StudentPointsTab';
import { StudentAttendanceStatsTab } from '@/components/StudentAttendanceStatsTab';
import { StudentFormDialog } from '@/components/StudentFormDialog';
import { RegeneratePasswordDialog } from '@/components/RegeneratePasswordDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, UserX, Clock, Pencil, Trash2, Award, BarChart3, StickyNote, Star, TrendingUp, KeyRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function StudentDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: res, isLoading } = useQuery({ queryKey: ['students', id], queryFn: () => studentApi.getById(id!) });
  const { data: tplRes } = useQuery({ queryKey: ['templates'], queryFn: () => templateApi.get() });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const student = res?.data;
  const fields = tplRes?.data?.student?.fields || [];

  const updateMut = useMutation({
    mutationFn: (data: any) => studentApi.update(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students', id] }); setEditOpen(false); toast.success(t('students.updated')); },
  });
  const deleteMut = useMutation({
    mutationFn: () => studentApi.delete(id!),
    onSuccess: () => { toast.success(t('students.deleted')); navigate('/students'); },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!student) return <div className="text-center py-12 text-muted-foreground">{t('students.notFound')}</div>;

  const fullName = `${student.firstname} ${student.lastname}`;

  // Use parents from the detail API response (already embedded), falling back to parentIds if needed
  const studentParents = student.parents ?? student.parentIds.map(pid => ({ id: pid, firstname: '', lastname: '' }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/students')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{fullName}</h1>
          <p className="text-muted-foreground">{t('common.id')}: {student.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="me-2 h-4 w-4" />{t('common.edit')}</Button>
          <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
            <KeyRound className="me-2 h-4 w-4" />
            {t('students.regeneratePassword')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="me-2 h-4 w-4" />{t('common.delete')}</Button>
          <QRCodeDisplay entityType="students" entityId={student.id} entityName={fullName} />
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="absences" className="gap-2"><UserX className="h-4 w-4" />{t('tabs.absences')}</TabsTrigger>
          <TabsTrigger value="lates" className="gap-2"><Clock className="h-4 w-4" />{t('tabs.lates')}</TabsTrigger>
          <TabsTrigger value="attendance-stats" className="gap-2"><TrendingUp className="h-4 w-4" />{t('tabs.attendanceStats')}</TabsTrigger>
          <TabsTrigger value="marks" className="gap-2"><Award className="h-4 w-4" />{t('tabs.marks')}</TabsTrigger>
          <TabsTrigger value="mark-stats" className="gap-2"><BarChart3 className="h-4 w-4" />{t('tabs.markStats')}</TabsTrigger>
          <TabsTrigger value="notes" className="gap-2"><StickyNote className="h-4 w-4" />{t('tabs.notes')}</TabsTrigger>
          <TabsTrigger value="points" className="gap-2"><Star className="h-4 w-4" />{t('tabs.points')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">{t('common.basicInformation')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">{t('common.firstName')}</p><p className="font-medium">{student.firstname}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('common.lastName')}</p><p className="font-medium">{student.lastname}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('common.level')}</p><p className="font-medium">{student.levelName || '—'}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('students.class')}</p><p className="font-medium">{student.className || '—'}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">{t('nav.parents')}</CardTitle></CardHeader>
              <CardContent>
                {studentParents.length === 0 ? (
                  <p className="text-muted-foreground">{t('common.noParentsAssigned')}</p>
                ) : (
                  <div className="space-y-2">
                    {studentParents.map(p => {
                      const name = p.firstname || p.lastname
                        ? `${p.firstname} ${p.lastname}`.trim()
                        : p.id;
                      return (
                        <div key={p.id} className="flex items-center gap-2">
                          <span
                            className="font-medium cursor-pointer hover:text-primary hover:underline"
                            onClick={() => navigate(`/parents/${p.id}`)}
                          >
                            {name}
                          </span>
                          {student.parentRelations?.[p.id] && (
                            <Badge variant="outline">{student.parentRelations[p.id]}</Badge>
                          )}
                          {p.id === student.defaultParentId && (
                            <Badge variant="secondary">{t('common.default')}</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">{t('common.additionalDetails')}</CardTitle></CardHeader>
              <CardContent><DynamicView fields={fields} data={student.dynamicFields || {}} /></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="absences">
          <EntityAttendanceTab entityType="student" entityId={student.id} entityName={fullName} recordType="absences" />
        </TabsContent>
        <TabsContent value="lates">
          <EntityAttendanceTab entityType="student" entityId={student.id} entityName={fullName} recordType="lates" />
        </TabsContent>
        <TabsContent value="attendance-stats">
          <StudentAttendanceStatsTab studentId={student.id} studentName={fullName} />
        </TabsContent>
        <TabsContent value="marks">
          <StudentMarkRecordsTab studentId={student.id} studentName={fullName} studentLevelId={student.levelId} studentClassId={student.classId} />
        </TabsContent>
        <TabsContent value="mark-stats">
          <StudentMarkStatsTab studentId={student.id} studentName={fullName} studentLevelId={student.levelId} />
        </TabsContent>
        <TabsContent value="notes">
          <StudentNotesTab studentId={student.id} studentName={fullName} />
        </TabsContent>
        <TabsContent value="points">
          <StudentPointsTab studentId={student.id} studentName={fullName} />
        </TabsContent>
      </Tabs>

      <StudentFormDialog
        key={student.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={student}
        fields={fields}
        isSubmitting={updateMut.isPending}
        onSubmit={(data: any) => updateMut.mutate(data)}
      />

      <RegeneratePasswordDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        entityId={student.id}
        entityName={fullName}
        onRegenerate={studentApi.regeneratePassword}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: t('nav.students').toLowerCase() })}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.deleteConfirmDesc', { name: fullName })} {t('common.deleteConfirmDescAction')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate()}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
