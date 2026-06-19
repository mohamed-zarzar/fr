import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parentApi, studentApi, templateApi } from '@/services/api';
import { DynamicView } from '@/components/DynamicView';
import { ParentFormDialog } from '@/components/ParentFormDialog';
import { RegeneratePasswordDialog } from '@/components/RegeneratePasswordDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Pencil, Trash2, KeyRound, UserPlus, UserMinus, Search, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Student } from '@/types';

export default function ParentDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: res, isLoading } = useQuery({ queryKey: ['parents', id], queryFn: () => parentApi.getById(id!) });
  const { data: tplRes } = useQuery({ queryKey: ['templates'], queryFn: () => templateApi.get() });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; name: string } | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [accumulatedStudents, setAccumulatedStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const parent = res?.data;
  const fields = tplRes?.data?.parent?.fields || [];

  const resetLinkDialog = () => {
    setStudentSearch('');
    setStudentPage(1);
    setSelectedStudent(null);
    setAccumulatedStudents([]);
  };

  const { data: studentSearchRes, isFetching: isSearching } = useQuery({
    queryKey: ['students', 'search', studentSearch, studentPage],
    queryFn: () => studentApi.select({ page: studentPage, limit: 10, search: studentSearch }),
    enabled: linkOpen && studentSearch.length > 0,
  });

  useEffect(() => {
    if (!studentSearchRes?.data) return;
    const newItems = studentSearchRes.data;
    if (studentPage === 1) {
      setAccumulatedStudents(newItems);
    } else {
      setAccumulatedStudents((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const appended = newItems.filter((s) => !seen.has(s.id));
        return [...prev, ...appended];
      });
    }
  }, [studentSearchRes, studentPage]);

  const updateMut = useMutation({
    mutationFn: (data: unknown) => parentApi.update(id!, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents', id] });
      setEditOpen(false);
      toast.success(t('parents.updated'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => parentApi.delete(id!),
    onSuccess: () => {
      toast.success(t('parents.deleted'));
      navigate('/parents');
    },
  });

  const linkMut = useMutation({
    mutationFn: (studentId: string) => parentApi.addStudent(id!, studentId),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ['parents', id] });
      setLinkOpen(false);
      resetLinkDialog();
      toast.success(t('parents.studentLinked'));
    },
    onError: () => toast.error(t('common.error')),
  });

  const unlinkMut = useMutation({
    mutationFn: (studentId: string) => parentApi.removeStudent(id!, studentId),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ['parents', id] });
      setUnlinkTarget(null);
      toast.success(t('parents.studentUnlinked'));
    },
    onError: () => toast.error(t('common.error')),
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!parent) return <div className="text-center py-12 text-muted-foreground">{t('parents.notFound')}</div>;

  const children = parent.students ?? [];
  const linkedStudentIds = new Set(children.map((c) => c.id));
  const searchResults = accumulatedStudents.filter((s) => !linkedStudentIds.has(s.id));
  const hasMorePages = (studentSearchRes?.totalPages ?? 0) > studentPage;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/parents')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold flex-1">{parent.firstname} {parent.lastname}</h1>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="me-2 h-4 w-4" />{t('common.edit')}</Button>
        <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)} title={t('students.regeneratePassword')}>
          <KeyRound className="me-2 h-4 w-4" />
          {t('students.regeneratePassword')}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="me-2 h-4 w-4" />{t('common.delete')}</Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="students">{t('common.relatedStudents')} ({children.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader><CardTitle className="text-lg">{t('common.details')}</CardTitle></CardHeader>
            <CardContent><DynamicView fields={fields} data={parent.dynamicFields || {}} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t('common.children')}</CardTitle>
              <Button size="sm" onClick={() => { setLinkOpen(true); resetLinkDialog(); }}>
                <UserPlus className="me-2 h-4 w-4" />
                {t('parents.addStudentRelation')}
              </Button>
            </CardHeader>
            <CardContent>
              {children.length === 0 ? <p className="text-muted-foreground">{t('common.noChildrenLinked')}</p> : (
                <div className="space-y-3">
                  {children.map(c => {
                    const relation = c.parentRelations?.[parent.id];
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50">
                        <div
                          className="flex items-center gap-2 flex-1 cursor-pointer"
                          onClick={() => navigate(`/students/${c.id}`)}
                        >
                          <div>
                            <p className="font-medium">{c.firstname} {c.lastname}</p>
                            <p className="text-sm text-muted-foreground">{t('common.id')}: {c.id}</p>
                          </div>
                          {relation && <Badge variant="outline">{relation}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/students/${c.id}`)}>{t('common.view')}</Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setUnlinkTarget({ id: c.id, name: `${c.firstname} ${c.lastname}` })}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Link student dialog */}
      <Dialog open={linkOpen} onOpenChange={(o) => { setLinkOpen(o); if (!o) resetLinkDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('parents.linkStudentTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-9"
                placeholder={t('parents.searchStudents')}
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setSelectedStudent(null);
                  setStudentPage(1);
                  setAccumulatedStudents([]);
                }}
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {isSearching && studentPage === 1 && accumulatedStudents.length === 0 && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isSearching && studentSearch.length > 0 && searchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">{t('parents.noStudentsFound')}</p>
              )}
              {searchResults.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-colors ${selectedStudent?.id === s.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50 border-transparent'}`}
                  onClick={() => setSelectedStudent(s)}
                >
                  <div>
                    <p className="text-sm font-medium">{s.firstname} {s.lastname}</p>
                    {s.code != null && <p className="text-xs text-muted-foreground">#{s.code}</p>}
                  </div>
                </div>
              ))}
              {hasMorePages && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={isSearching}
                  onClick={() => setStudentPage((p) => p + 1)}
                >
                  {isSearching && studentPage > 1 ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t('common.loadMore', { defaultValue: 'Load more' })}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>{t('common.cancel')}</Button>
            <Button
              disabled={!selectedStudent || linkMut.isPending}
              onClick={() => selectedStudent && linkMut.mutate(selectedStudent.id)}
            >
              {linkMut.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('parents.addStudentRelation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParentFormDialog
        key={parent.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={parent}
        fields={fields}
        isSubmitting={updateMut.isPending}
        onSubmit={(data) => updateMut.mutate(data)}
        title={t('common.parent')}
      />

      <RegeneratePasswordDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        entityId={parent.id}
        entityName={`${parent.firstname} ${parent.lastname}`}
        onRegenerate={parentApi.regeneratePassword}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('common.deleteConfirmTitle', { entity: t('nav.parents').toLowerCase() })}</AlertDialogTitle><AlertDialogDescription>{t('common.deleteConfirmDesc', { name: `${parent.firstname} ${parent.lastname}` })}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMut.mutate()}>{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink confirmation dialog */}
      <AlertDialog open={!!unlinkTarget} onOpenChange={(o) => { if (!o) setUnlinkTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('parents.removeStudentRelation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('parents.confirmUnlink')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkTarget && unlinkMut.mutate(unlinkTarget.id)}
              disabled={unlinkMut.isPending}
            >
              {unlinkMut.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
