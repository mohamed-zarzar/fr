import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { surveyApi } from '@/services/survey-api';
import { classApi, levelApi, studentApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, ListChecks, Type, Star, Columns2, Link2, Smartphone,
  Info, AlertTriangle, AlertCircle, Eye, Users, Copy, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SurveyQuestionType, NoteColor } from '@/types/survey';

export default function SurveyDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: surveyRes } = useQuery({ queryKey: ['survey', id], queryFn: () => surveyApi.getById(id!) });
  const { data: responsesRes } = useQuery({ queryKey: ['survey-responses', id], queryFn: () => surveyApi.getResponses(id!), enabled: !!surveyRes?.data });
  const { data: classesRes } = useQuery({ queryKey: ['classes-all'], queryFn: () => classApi.getAll({ page: 1, limit: 100 }) });
  const { data: levelsRes } = useQuery({ queryKey: ['levels-all'], queryFn: () => levelApi.getAll({ page: 1, limit: 100 }) });
  const { data: studentsRes } = useQuery({ queryKey: ['students-all'], queryFn: () => studentApi.getAll({ page: 1, limit: 100 }) });

  const survey = surveyRes?.data;
  const responses = responsesRes?.data ?? [];
  const classes = classesRes?.data ?? [];
  const levels = levelsRes?.data ?? [];
  const students = studentsRes?.data ?? [];

  if (!survey) return <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>;

  const getTargetName = (id: string) => {
    if (survey.targetType === 'class') return classes.find(c => c.id === id)?.name ?? id;
    return levels.find(l => l.id === id)?.name ?? id;
  };

  const getStudentName = (id: string) => {
    const s = students.find(x => x.id === id);
    return s ? `${s.firstname} ${s.lastname}` : id;
  };

  const typeIcons: Record<SurveyQuestionType, React.ReactNode> = {
    multiple_choice: <ListChecks className="h-4 w-4 text-primary" />,
    text: <Type className="h-4 w-4 text-primary" />,
    rating: <Star className="h-4 w-4 text-primary" />,
    pros_cons: <Columns2 className="h-4 w-4 text-primary" />,
  };

  const typeLabels: Record<SurveyQuestionType, string> = {
    multiple_choice: t('surveys.multipleChoice'),
    text: t('surveys.textResponse'),
    rating: t('surveys.ratingOutOfTen'),
    pros_cons: t('surveys.prosCons'),
  };

  const noteColorMap: Record<NoteColor, string> = {
    info: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    warn: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800',
    danger: 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
  };

  const noteIconMap: Record<NoteColor, React.ReactNode> = {
    info: <Info className="h-4 w-4 shrink-0" />,
    warn: <AlertTriangle className="h-4 w-4 shrink-0" />,
    danger: <AlertCircle className="h-4 w-4 shrink-0" />,
  };

  const statusVariant = (s: string) => s === 'active' ? 'default' : s === 'closed' ? 'destructive' : 'outline';

  const beginningNotes = survey.notes.filter(n => n.position === 'beginning');
  const endNotes = survey.notes.filter(n => n.position === 'end');

  const mockLink = `${window.location.origin}/survey-response/${survey.id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(mockLink);
    toast.success(t('surveys.linkCopied'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/surveys')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{survey.title}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant={statusVariant(survey.status)}>{t(`surveys.${survey.status}`)}</Badge>
              <Badge variant="secondary">
                {survey.distribution === 'link' ? <><Link2 className="h-3 w-3 me-1" />{t('surveys.link')}</> : <><Smartphone className="h-3 w-3 me-1" />{t('surveys.studentApp')}</>}
              </Badge>
              {survey.targetIds.map(tid => (
                <Badge key={tid} variant="outline">{getTargetName(tid)}</Badge>
              ))}
            </div>
          </div>
        </div>
        {survey.distribution === 'link' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}><Copy className="h-4 w-4 me-1" />{t('surveys.copyLink')}</Button>
            <Button variant="outline" size="sm" onClick={() => window.open(mockLink, '_blank')}><ExternalLink className="h-4 w-4 me-1" />{t('surveys.openLink')}</Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{survey.questions.length}</p><p className="text-sm text-muted-foreground">{t('surveys.questionsCount')}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{survey.responsesCount}</p><p className="text-sm text-muted-foreground">{t('surveys.responses')}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{survey.notes.length}</p><p className="text-sm text-muted-foreground">{t('surveys.notesCount')}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{survey.targetIds.length}</p><p className="text-sm text-muted-foreground">{t('surveys.targets')}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview"><Eye className="h-4 w-4 me-1" />{t('surveys.preview')}</TabsTrigger>
          <TabsTrigger value="responses"><Users className="h-4 w-4 me-1" />{t('surveys.responses')} ({responses.length})</TabsTrigger>
        </TabsList>

        {/* ─ Preview Tab ─ */}
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">{survey.title}</CardTitle>
              <CardDescription>{t('surveys.previewDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Beginning Notes */}
              {beginningNotes.map(n => (
                <div key={n.id} className={`flex items-start gap-2 border rounded-lg p-3 ${noteColorMap[n.color]}`}>
                  {noteIconMap[n.color]}
                  <p className="text-sm">{n.text}</p>
                </div>
              ))}

              <Separator />

              {/* Questions Preview */}
              {survey.questions.sort((a, b) => a.order - b.order).map((q, idx) => (
                <div key={q.id} className="space-y-2 p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground">{idx + 1}.</span>
                    {typeIcons[q.type]}
                    <Badge variant="outline" className="text-xs">{typeLabels[q.type]}</Badge>
                  </div>
                  <p className="font-medium text-foreground">{q.text}</p>

                  {q.type === 'multiple_choice' && q.options && (
                    <div className="space-y-1.5 ps-6">
                      {q.options.map((opt, oi) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                          <span className="text-sm">{String.fromCharCode(65 + oi)}. {opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'text' && (
                    <div className="ps-6">
                      <div className="border border-dashed rounded-md p-3 text-sm text-muted-foreground">{t('surveys.textPlaceholder')}</div>
                    </div>
                  )}

                  {q.type === 'rating' && (
                    <div className="ps-6 flex gap-1" dir="ltr">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-xs text-muted-foreground">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'pros_cons' && (
                    <div className="ps-6 grid grid-cols-2 gap-3">
                      <div className="border rounded-md p-3">
                        <p className="text-sm font-medium text-green-600 mb-2">{t('surveys.pros')}</p>
                        <div className="border border-dashed rounded p-2 text-xs text-muted-foreground">{t('surveys.textPlaceholder')}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <p className="text-sm font-medium text-destructive mb-2">{t('surveys.cons')}</p>
                        <div className="border border-dashed rounded p-2 text-xs text-muted-foreground">{t('surveys.textPlaceholder')}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* End Notes */}
              {endNotes.length > 0 && <Separator />}
              {endNotes.map(n => (
                <div key={n.id} className={`flex items-start gap-2 border rounded-lg p-3 ${noteColorMap[n.color]}`}>
                  {noteIconMap[n.color]}
                  <p className="text-sm">{n.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─ Responses Tab ─ */}
        <TabsContent value="responses" className="mt-4">
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              {responses.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">{t('surveys.noResponses')}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.student')}</TableHead>
                      <TableHead>{t('surveys.submittedAt')}</TableHead>
                      {survey.questions.map(q => (
                        <TableHead key={q.id} className="text-xs">{q.text.substring(0, 30)}{q.text.length > 30 ? '...' : ''}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map(resp => (
                      <TableRow key={resp.id}>
                        <TableCell className="font-medium">{resp.studentId ? getStudentName(resp.studentId) : t('surveys.anonymous')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(resp.submittedAt).toLocaleDateString()}</TableCell>
                        {survey.questions.map(q => {
                          const ans = resp.answers[q.id];
                          let display = '—';
                          if (q.type === 'multiple_choice') {
                            display = q.options?.find(o => o.id === ans)?.text ?? (ans || '—');
                          } else if (q.type === 'rating') {
                            display = ans ? `${ans}/10` : '—';
                          } else if (q.type === 'text') {
                            display = ans || '—';
                          } else if (q.type === 'pros_cons' && ans) {
                            display = `+${(ans.pros || []).length} / -${(ans.cons || []).length}`;
                          }
                          return <TableCell key={q.id} className="text-sm">{display}</TableCell>;
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
