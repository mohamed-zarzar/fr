import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherApi, templateApi } from '@/services/api';
import { MarkStatisticsPanel } from '@/components/MarkStatisticsPanel';
import { DynamicView } from '@/components/DynamicView';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { EntityAttendanceTab } from '@/components/EntityAttendanceTab';
import { TeacherFormDialog } from '@/components/TeacherFormDialog';
import { RegeneratePasswordDialog } from '@/components/RegeneratePasswordDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, UserX, Clock, Pencil, Trash2, BarChart3, KeyRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function TeacherDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: res, isLoading } = useQuery({ queryKey: ['teachers', id], queryFn: () => teacherApi.getById(id!) });
  const { data: tplRes } = useQuery({ queryKey: ['templates'], queryFn: () => templateApi.get() });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const teacher = res?.data;
  const fields = tplRes?.data?.teacher?.fields || [];

  const updateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => teacherApi.update(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teachers', id] }); setEditOpen(false); toast.success(t('teachers.updated')); },
  });
  const deleteMut = useMutation({
    mutationFn: () => teacherApi.delete(id!),
    onSuccess: () => { toast.success(t('teachers.deleted')); navigate('/teachers'); },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!teacher) return <div className="text-center py-12 text-muted-foreground">{t('teachers.notFound')}</div>;

  const classAssignments = teacher.classAssignments || [];
  const fullName = `${teacher.firstname} ${teacher.lastname}`;
  const subjectDisplay =
    teacher.subjects?.length ? teacher.subjects : teacher.subjectIds.map((id) => ({ id, name: id }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/teachers')} className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl sm:text-2xl font-bold flex-1 truncate">{fullName}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="me-2 h-4 w-4" />{t('common.edit')}</Button>
          <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
            <KeyRound className="me-2 h-4 w-4" />
            {t('students.regeneratePassword')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="me-2 h-4 w-4" />{t('common.delete')}</Button>
          <QRCodeDisplay entityType="teachers" entityId={teacher.id} entityName={fullName} />
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="absences" className="gap-2"><UserX className="h-4 w-4" /><span className="hidden sm:inline">{t('tabs.absences')}</span></TabsTrigger>
          <TabsTrigger value="lates" className="gap-2"><Clock className="h-4 w-4" /><span className="hidden sm:inline">{t('tabs.lates')}</span></TabsTrigger>
          <TabsTrigger value="marks" className="gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">{t('tabs.markStats')}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">{t('nav.subjects')}</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {subjectDisplay.map((s) => (
                  <Badge key={s.id} variant="secondary">
                    {s.name}
                  </Badge>
                ))}
                {subjectDisplay.length === 0 && <p className="text-muted-foreground">{t('common.noneAssigned')}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">{t('common.classAssignments')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {classAssignments.length === 0 && <p className="text-muted-foreground">{t('common.noneAssigned')}</p>}
                {classAssignments.map((a) => (
                  <div key={a.classId} className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{a.className || a.classId}</Badge>
                    <span className="text-muted-foreground text-xs">→</span>
                    <div className="flex flex-wrap gap-1">
                      {a.subjectIds.map((sid, i) => (
                        <Badge key={sid} variant="secondary" className="text-xs">
                          {a.subjectNames?.[i] ?? sid}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">{t('common.additionalDetails')}</CardTitle></CardHeader>
              <CardContent><DynamicView fields={fields} data={teacher.dynamicFields || {}} /></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="absences">
          <EntityAttendanceTab entityType="teacher" entityId={teacher.id} entityName={fullName} recordType="absences" />
        </TabsContent>
        <TabsContent value="lates">
          <EntityAttendanceTab entityType="teacher" entityId={teacher.id} entityName={fullName} recordType="lates" />
        </TabsContent>
        <TabsContent value="marks">
          <MarkStatisticsPanel fixedTeacherClassSubjects={classAssignments} showFilters={true} title={`${t('marks.statistics')} — ${fullName}`} />
        </TabsContent>
      </Tabs>

      <TeacherFormDialog
        key={teacher.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={teacher}
        fields={fields}
        isSubmitting={updateMut.isPending}
        onSubmit={(data) => updateMut.mutate(data)}
      />

      <RegeneratePasswordDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        entityId={teacher.id}
        entityName={fullName}
        onRegenerate={teacherApi.regeneratePassword}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: t('nav.teachers').toLowerCase() })}</AlertDialogTitle><AlertDialogDescription>{t('common.deleteConfirmDesc', { name: fullName })}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMut.mutate()}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
