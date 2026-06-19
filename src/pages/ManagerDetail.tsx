import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managerApi, templateApi } from '@/services/api';
import { DynamicView } from '@/components/DynamicView';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { EntityAttendanceTab } from '@/components/EntityAttendanceTab';
import { ManagerFormDialog } from '@/components/ManagerFormDialog';
import { RegeneratePasswordDialog } from '@/components/RegeneratePasswordDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, UserX, Clock, Pencil, Trash2, KeyRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function ManagerDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: res, isLoading } = useQuery({ queryKey: ['managers', id], queryFn: () => managerApi.getById(id!) });
  const { data: tplRes } = useQuery({ queryKey: ['templates'], queryFn: () => templateApi.get() });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const manager = res?.data;
  const fields = tplRes?.data?.manager?.fields || [];

  const updateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => managerApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managers', id] });
      setEditOpen(false);
      toast.success(t('managers.updated'));
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => managerApi.delete(id!),
    onSuccess: () => {
      toast.success(t('managers.deleted'));
      navigate('/managers');
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!manager) return <div className="text-center py-12 text-muted-foreground">{t('managers.notFound')}</div>;

  const fullName = `${manager.firstname} ${manager.lastname}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/managers')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{fullName}</h1>
          <p className="text-muted-foreground">{t('common.id')}: {manager.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="me-2 h-4 w-4" />{t('common.edit')}</Button>
          <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
            <KeyRound className="me-2 h-4 w-4" />
            {t('students.regeneratePassword')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="me-2 h-4 w-4" />{t('common.delete')}</Button>
          <QRCodeDisplay entityType="managers" entityId={manager.id} entityName={fullName} />
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="absences" className="gap-2"><UserX className="h-4 w-4" />{t('tabs.absences')}</TabsTrigger>
          <TabsTrigger value="lates" className="gap-2"><Clock className="h-4 w-4" />{t('tabs.lates')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">{t('common.basicInformation')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">{t('common.firstName')}</p><p className="font-medium">{manager.firstname}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('common.lastName')}</p><p className="font-medium">{manager.lastname}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('common.code')}</p><p className="font-medium">{manager.code ?? '—'}</p></div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{t('common.assignedClasses')}</p>
                  {manager.classIds.length === 0 ? (
                    <p className="text-muted-foreground">{t('common.noneAssigned')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {manager.classIds.map((cid, i) => (
                        <Badge
                          key={cid}
                          variant="outline"
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => navigate(`/classes/${cid}`)}
                        >
                          {manager.classNames?.[i] ?? cid}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">{t('common.additionalDetails')}</CardTitle></CardHeader>
              <CardContent><DynamicView fields={fields} data={manager.dynamicFields || {}} /></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="absences">
          <EntityAttendanceTab entityType="manager" entityId={manager.id} entityName={fullName} recordType="absences" />
        </TabsContent>
        <TabsContent value="lates">
          <EntityAttendanceTab entityType="manager" entityId={manager.id} entityName={fullName} recordType="lates" />
        </TabsContent>
      </Tabs>

      <ManagerFormDialog
        key={manager.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={manager}
        fields={fields}
        isSubmitting={updateMut.isPending}
        onSubmit={(data) => updateMut.mutate(data)}
      />

      <RegeneratePasswordDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        entityId={manager.id}
        entityName={fullName}
        onRegenerate={managerApi.regeneratePassword}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: t('nav.managers').toLowerCase() })}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.deleteConfirmDesc', { name: fullName })} {t('common.deleteConfirmDescAction')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMut.mutate()}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
