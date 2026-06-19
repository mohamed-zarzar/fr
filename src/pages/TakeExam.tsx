import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { examApi, attemptApi } from '@/services/exam-api';
import { studentApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StudentSelect } from '@/components/selects/StudentSelect';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Send, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Question, ExamAttempt } from '@/types/exam';

type Step = 'student' | 'answer';

export default function TakeExam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('student');
  const [studentId, setStudentId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExamAttempt | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: examRes } = useQuery({ queryKey: ['exam', id], queryFn: () => examApi.getById(id!) });
  const exam = examRes?.data;

  const { data: studentRes } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => studentApi.getById(studentId),
    enabled: !!studentId,
  });
  const selectedStudent = studentRes?.data ?? null;

  const { data: questionsRes } = useQuery({
    queryKey: ['exam-questions', id],
    queryFn: () => examApi.getQuestionsForExam(id!),
    enabled: !!exam,
  });
  const examQuestions: Question[] = questionsRes?.data ?? [];

  const submitMut = useMutation({
    mutationFn: () => attemptApi.submit(id!, studentId, answers),
    onSuccess: (res) => {
      setResult(res.data);
      setConfirmOpen(false);
      toast({ title: t('exams.scoreToast', { score: res.data.score, total: res.data.totalQuestions }) });
    },
  });

  const goToAnswerStep = () => {
    if (!studentId) {
      toast({ title: t('exams.selectStudent'), variant: 'destructive' });
      return;
    }
    setStep('answer');
  };

  const requestSubmit = () => {
    if (Object.keys(answers).length < examQuestions.length) {
      toast({ title: t('exams.answerAllQuestions'), variant: 'destructive' });
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSubmit = () => {
    submitMut.mutate();
  };

  const submitAnother = () => {
    setResult(null);
    setShowReview(false);
    setStudentId('');
    setAnswers({});
    setStep('student');
  };

  const answeredCount = Object.keys(answers).length;
  const progress = examQuestions.length > 0 ? (answeredCount / examQuestions.length) * 100 : 0;

  if (!exam) return <div className="text-center py-12 text-muted-foreground">{t('exams.loadingExam')}</div>;

  if (result) {
    const percentage = Math.round((result.score / result.totalQuestions) * 100);
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/exams')}><ArrowLeft className="h-4 w-4 mr-2" /> {t('exams.backToExams')}</Button>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('exams.examResults')}</CardTitle>
            <CardDescription>{exam.name}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-5xl font-bold text-primary">{percentage}%</div>
            <p className="text-lg text-foreground">{t('exams.scoreCorrect', { score: result.score, total: result.totalQuestions })}</p>
            <Progress value={percentage} className="h-3" />
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowReview(!showReview)}>
                {showReview ? t('exams.hideReview') : t('exams.reviewAnswers')}
              </Button>
              <Button variant="outline" onClick={submitAnother}>
                <RotateCcw className="h-4 w-4 mr-2" /> {t('exams.submitAnother')}
              </Button>
              <Button onClick={() => navigate('/exams')}>{t('exams.backToExams')}</Button>
            </div>
          </CardContent>
        </Card>

        {showReview && examQuestions.map((q, i) => {
          const isCorrect = answers[q.id] === q.correctAnswerId;
          return (
            <Card key={q.id} className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 mb-3">
                  {isCorrect ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                  <p className="font-medium text-foreground">{i + 1}. {q.text}</p>
                </div>
                <div className="ml-7 space-y-1">
                  {q.options.map(opt => {
                    const isSelected = answers[q.id] === opt.id;
                    const isAnswer = q.correctAnswerId === opt.id;
                    return (
                      <div key={opt.id} className={`text-sm py-1 px-2 rounded ${isAnswer ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-medium' : isSelected && !isAnswer ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 line-through' : 'text-muted-foreground'}`}>
                        {opt.text} {isAnswer && '✓'} {isSelected && !isAnswer && '✗'}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate('/exams')}><ArrowLeft className="h-4 w-4 mr-2" /> {t('exams.backToExams')}</Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>{exam.name}</CardTitle>
              <CardDescription>{t('exams.questionsCount', { count: examQuestions.length })}</CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0">
              {step === 'student' ? t('exams.stepStudent') : t('exams.stepAnswer')}
            </Badge>
          </div>
        </CardHeader>
        {step === 'answer' && (
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('exams.student')}: <span className="font-medium text-foreground">{selectedStudent ? `${selectedStudent.firstname} ${selectedStudent.lastname}` : ''}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setStep('student')}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {t('exams.changeStudent')}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1 h-2" />
              <span className="text-sm text-muted-foreground">{answeredCount}/{examQuestions.length}</span>
            </div>
          </CardContent>
        )}
      </Card>

      {step === 'student' && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label>{t('exams.selectStudent')} *</Label>
              <StudentSelect
                value={studentId}
                onChange={setStudentId}
                placeholder={t('exams.chooseStudent')}
                className="w-full"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={goToAnswerStep} disabled={!studentId}>
                {t('exams.next')} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'answer' && (
        <>
          {examQuestions.map((q, i) => (
            <Card key={q.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="font-medium text-foreground">{i + 1}. {q.text}</p>
                  <Badge variant="outline" className="shrink-0 ml-2">{t(`questions.${q.difficulty}`, { defaultValue: q.difficulty })}</Badge>
                </div>
                <RadioGroup value={answers[q.id] || ''} onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}>
                  {q.options.map(opt => (
                    <div key={opt.id} className="flex items-center gap-2 py-1">
                      <RadioGroupItem value={opt.id} id={`${q.id}-${opt.id}`} />
                      <Label htmlFor={`${q.id}-${opt.id}`} className="cursor-pointer">{opt.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          {examQuestions.length > 0 && (
            <div className="flex justify-end">
              <Button size="lg" onClick={requestSubmit} disabled={submitMut.isPending}>
                <Send className="h-4 w-4 mr-2" /> {t('exams.submitExam')}
              </Button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('exams.confirmSubmitTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('exams.confirmSubmitDesc', { answered: answeredCount, total: examQuestions.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitMut.isPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit} disabled={submitMut.isPending}>
              {submitMut.isPending ? t('common.saving') : t('exams.confirmSubmit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
