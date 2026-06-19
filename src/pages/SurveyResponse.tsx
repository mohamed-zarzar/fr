import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { surveyApi } from '@/services/survey-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, AlertCircle, CheckCircle2, ListChecks, Type, Star, Columns2 } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { SurveyQuestionType, NoteColor } from '@/types/survey';

export default function SurveyResponse() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: surveyRes, isLoading } = useQuery({
    queryKey: ['survey-public', id],
    queryFn: () => surveyApi.getById(id!),
  });

  const submitMutation = useMutation({
    mutationFn: () => surveyApi.submitResponse({ surveyId: id!, answers }),
    onSuccess: () => {
      setSubmitted(true);
      toast.success(t('surveyResponse.submitted'));
    },
  });

  const survey = surveyRes?.data;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('common.loading')}</div>;
  if (!survey) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('surveyResponse.notFound')}</div>;
  if (survey.status !== 'active') return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="pt-6 text-center space-y-2">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-lg font-medium">{t('surveyResponse.notActive')}</p>
          <p className="text-sm text-muted-foreground">{t('surveyResponse.notActiveDesc')}</p>
        </CardContent>
      </Card>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <p className="text-xl font-bold">{t('surveyResponse.thankYou')}</p>
          <p className="text-sm text-muted-foreground">{t('surveyResponse.thankYouDesc')}</p>
        </CardContent>
      </Card>
    </div>
  );

  const setAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
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

  const beginningNotes = survey.notes.filter(n => n.position === 'beginning');
  const endNotes = survey.notes.filter(n => n.position === 'end');
  const sortedQuestions = [...survey.questions].sort((a, b) => a.order - b.order);

  const allAnswered = sortedQuestions.every(q => {
    const a = answers[q.id];
    if (q.type === 'pros_cons') return a?.pros?.length > 0 || a?.cons?.length > 0;
    return a !== undefined && a !== '';
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header with language switcher */}
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">{survey.title}</CardTitle>
            <CardDescription>{t('surveyResponse.fillDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Beginning Notes */}
            {beginningNotes.map(n => (
              <div key={n.id} className={`flex items-start gap-2 border rounded-lg p-3 ${noteColorMap[n.color]}`}>
                {noteIconMap[n.color]}
                <p className="text-sm">{n.text}</p>
              </div>
            ))}

            {beginningNotes.length > 0 && <Separator />}

            {/* Questions */}
            {sortedQuestions.map((q, idx) => (
              <div key={q.id} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground">{idx + 1}.</span>
                  {typeIcons[q.type]}
                  <Badge variant="outline" className="text-xs">{typeLabels[q.type]}</Badge>
                </div>
                <p className="font-medium text-foreground">{q.text}</p>

                {/* Multiple Choice */}
                {q.type === 'multiple_choice' && q.options && (
                  <div className="space-y-2 ps-6">
                    {q.options.map((opt, oi) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswer(q.id, opt.id)}
                        className={`flex items-center gap-3 w-full text-start p-2.5 rounded-lg border-2 transition-colors ${
                          answers[q.id] === opt.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          answers[q.id] === opt.id ? 'border-primary' : 'border-muted-foreground/30'
                        }`}>
                          {answers[q.id] === opt.id && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm">{String.fromCharCode(65 + oi)}. {opt.text}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Text */}
                {q.type === 'text' && (
                  <div className="ps-6">
                    <Textarea
                      value={answers[q.id] || ''}
                      onChange={e => setAnswer(q.id, e.target.value)}
                      placeholder={t('surveys.textPlaceholder')}
                      rows={3}
                    />
                  </div>
                )}

                {/* Rating */}
                {q.type === 'rating' && (
                  <div className="ps-6 flex gap-1.5 flex-wrap" dir="ltr">
                    {Array.from({ length: 10 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAnswer(q.id, i + 1)}
                        className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors ${
                          answers[q.id] === i + 1
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30 hover:border-primary/50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Pros & Cons */}
                {q.type === 'pros_cons' && (
                  <div className="ps-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border rounded-md p-3 space-y-2">
                      <p className="text-sm font-medium text-green-600">{t('surveys.pros')}</p>
                      <Textarea
                        value={answers[q.id]?.pros?.join('\n') || ''}
                        onChange={e => setAnswer(q.id, { ...answers[q.id], pros: e.target.value.split('\n').filter(Boolean) })}
                        placeholder={t('surveyResponse.prosPlaceholder')}
                        rows={3}
                      />
                    </div>
                    <div className="border rounded-md p-3 space-y-2">
                      <p className="text-sm font-medium text-destructive">{t('surveys.cons')}</p>
                      <Textarea
                        value={answers[q.id]?.cons?.join('\n') || ''}
                        onChange={e => setAnswer(q.id, { ...answers[q.id], cons: e.target.value.split('\n').filter(Boolean) })}
                        placeholder={t('surveyResponse.consPlaceholder')}
                        rows={3}
                      />
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

            <Separator />

            <Button
              className="w-full"
              size="lg"
              disabled={!allAnswered || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? t('common.saving') : t('surveyResponse.submit')}
            </Button>
            {!allAnswered && (
              <p className="text-xs text-muted-foreground text-center">{t('surveyResponse.answerAll')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
