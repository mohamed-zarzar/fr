import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examApi, attemptApi } from '@/services/exam-api';
import { studentApi } from '@/services/api';
import { processAnswerSheet, mapOMRAnswersToExam, type OMRResult } from '@/lib/omr-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Camera, RotateCcw, Send, CheckCircle2, XCircle,
  AlertTriangle, Upload, ImageIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Question, ExamAttempt } from '@/types/exam';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

type ScanStep = 'setup' | 'camera' | 'review' | 'result';

export default function ScanExam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ScanStep>('setup');
  const [studentId, setStudentId] = useState('');
  const [omrResult, setOmrResult] = useState<OMRResult | null>(null);
  const [editedAnswers, setEditedAnswers] = useState<Record<number, string | null>>({});
  const [result, setResult] = useState<ExamAttempt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: examRes } = useQuery({
    queryKey: ['exam', id],
    queryFn: () => examApi.getById(id!),
  });
  const exam = examRes?.data;

  const { data: studentsRes } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => studentApi.getAll({ page: 1, limit: 100 }),
  });
  const students = studentsRes?.data ?? [];

  const { data: questionsRes } = useQuery({
    queryKey: ['exam-questions-scan', id],
    queryFn: () => examApi.getQuestionsForExam(id!),
    enabled: !!id,
  });
  const examQuestions: Question[] = questionsRes?.data ?? [];

  // Submit mutation
  const submitMut = useMutation({
    mutationFn: ({ answers }: { answers: Record<string, string> }) =>
      attemptApi.submit(id!, studentId, answers),
    onSuccess: (res) => {
      setResult(res.data);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast({ title: `النتيجة: ${res.data.score}/${res.data.totalQuestions}` });
    },
  });

  // Camera management
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraError('تعذر الوصول إلى الكاميرا. تأكد من منح صلاحية الكاميرا.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (step === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  // Capture from camera
  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      const result = await processAnswerSheet(canvas, examQuestions.length);
      setOmrResult(result);
      setEditedAnswers({ ...result.answers });
      setStep('review');
    } catch (err) {
      toast({ title: 'فشلت المعالجة', description: 'حاول مرة أخرى', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [examQuestions.length, toast]);

  // Upload image file
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsProcessing(true);

      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });

        const result = await processAnswerSheet(img, examQuestions.length);
        setOmrResult(result);
        setEditedAnswers({ ...result.answers });
        setStep('review');
        URL.revokeObjectURL(img.src);
      } catch (err) {
        toast({ title: 'فشل تحميل الصورة', variant: 'destructive' });
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [examQuestions.length, toast]
  );

  // Edit an answer in review
  const handleAnswerEdit = (questionNum: number, option: string | null) => {
    setEditedAnswers((prev) => ({
      ...prev,
      [questionNum]: prev[questionNum] === option ? null : option,
    }));
  };

  // Submit the edited answers
  const handleSubmit = () => {
    if (!studentId) {
      toast({ title: 'اختر الطالب أولاً', variant: 'destructive' });
      return;
    }
    if (!exam || examQuestions.length === 0) return;

    // Convert edited answers (num -> A/B/C/D) to (questionId -> optionId)
    const mappedAnswers = mapOMRAnswersToExam(editedAnswers, examQuestions);
    submitMut.mutate({ answers: mappedAnswers });
  };

  if (!exam) {
    return (
      <div className="text-center py-12 text-muted-foreground">جاري تحميل الاختبار...</div>
    );
  }

  // ── Result view ──
  if (step === 'result' && result) {
    const percentage = Math.round((result.score / result.totalQuestions) * 100);
    return (
      <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
        <Button variant="ghost" onClick={() => navigate('/exams')}>
          <ArrowLeft className="h-4 w-4 ml-2" /> العودة للاختبارات
        </Button>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">نتائج التصحيح</CardTitle>
            <CardDescription>{exam.name}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-5xl font-bold text-primary">{percentage}%</div>
            <p className="text-lg text-foreground">
              {result.score} / {result.totalQuestions} إجابة صحيحة
            </p>
            <Progress value={percentage} className="h-3" />
            <div className="flex justify-center gap-3 pt-4">
              <Button onClick={() => navigate('/exams')}>العودة للاختبارات</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Review view ──
  if (step === 'review' && omrResult) {
    const answeredCount = Object.values(editedAnswers).filter((v) => v !== null).length;
    return (
      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
        <Button variant="ghost" onClick={() => setStep('camera')}>
          <ArrowLeft className="h-4 w-4 ml-2" /> إعادة التصوير
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>مراجعة الإجابات - {exam.name}</CardTitle>
            <CardDescription>
              تم اكتشاف {answeredCount} إجابة من {examQuestions.length} سؤال.
              {omrResult.flaggedQuestions.length > 0 && (
                <span className="text-yellow-600 mr-2">
                  {' '}
                  ({omrResult.flaggedQuestions.length} تحتاج مراجعة)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Confidence indicator */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">دقة الاكتشاف:</span>
              <Progress value={omrResult.confidence * 100} className="flex-1 h-2" />
              <span className="text-sm text-muted-foreground">
                {Math.round(omrResult.confidence * 100)}%
              </span>
            </div>

            {/* Student selection */}
            <div>
              <Label>اختر الطالب *</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الطالب" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstname} {s.lastname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Debug image */}
            {omrResult.debugImageUrl && (
              <details className="border rounded-md p-2">
                <summary className="text-sm cursor-pointer text-muted-foreground">
                  عرض صورة التحليل
                </summary>
                <img
                  src={omrResult.debugImageUrl}
                  alt="Debug"
                  className="mt-2 max-w-full rounded border"
                />
              </details>
            )}

            {/* Answers grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" dir="ltr">
              {Array.from({ length: examQuestions.length }, (_, i) => i + 1).map((qNum) => {
                const isFlagged = omrResult.flaggedQuestions.includes(qNum);
                const selectedAnswer = editedAnswers[qNum];
                return (
                  <div
                    key={qNum}
                    className={`border rounded-md p-2 ${
                      isFlagged ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">Q{qNum}</span>
                      {isFlagged && (
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex gap-1">
                      {OPTION_LABELS.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => handleAnswerEdit(qNum, opt)}
                          className={`w-7 h-7 rounded-full border text-xs font-bold transition-colors ${
                            selectedAnswer === opt
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-muted-foreground/30 hover:border-primary/50'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('camera')}>
                <RotateCcw className="h-4 w-4 ml-2" /> إعادة التصوير
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitMut.isPending || !studentId}
                size="lg"
              >
                <Send className="h-4 w-4 ml-2" /> تسليم وحساب النتيجة
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Camera view ──
  if (step === 'camera') {
    return (
      <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
        <Button variant="ghost" onClick={() => { stopCamera(); setStep('setup'); }}>
          <ArrowLeft className="h-4 w-4 ml-2" /> رجوع
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>تصوير ورقة الإجابة</CardTitle>
            <CardDescription>
              وجّه الكاميرا نحو ورقة الإجابة بحيث تظهر العلامات السوداء الأربع في الزوايا
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameraError ? (
              <div className="text-center py-8 space-y-3">
                <XCircle className="h-10 w-10 text-destructive mx-auto" />
                <p className="text-sm text-destructive">{cameraError}</p>
                <Button variant="outline" onClick={startCamera}>
                  إعادة المحاولة
                </Button>
              </div>
            ) : (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full"
                  style={{ maxHeight: '60vh' }}
                />
                {/* Guide overlay */}
                <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-lg pointer-events-none" />
                <div className="absolute top-6 left-6 w-6 h-6 border-t-2 border-l-2 border-white/70" />
                <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-white/70" />
                <div className="absolute bottom-6 left-6 w-6 h-6 border-b-2 border-l-2 border-white/70" />
                <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-white/70" />
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-3 justify-center">
              <Button
                size="lg"
                onClick={captureAndProcess}
                disabled={isProcessing || !!cameraError}
              >
                {isProcessing ? (
                  'جاري المعالجة...'
                ) : (
                  <>
                    <Camera className="h-4 w-4 ml-2" /> التقاط وتحليل
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload className="h-4 w-4 ml-2" /> رفع صورة
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Setup view (default) ──
  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <Button variant="ghost" onClick={() => navigate('/exams')}>
        <ArrowLeft className="h-4 w-4 ml-2" /> العودة للاختبارات
      </Button>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">تصحيح ورقة الإجابة بالكاميرا</CardTitle>
          <CardDescription>{exam.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="border rounded-lg p-4">
              <p className="text-2xl font-bold text-primary">{examQuestions.length}</p>
              <p className="text-sm text-muted-foreground">عدد الأسئلة</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-2xl font-bold text-primary">{exam.maxScore}</p>
              <p className="text-sm text-muted-foreground">الدرجة الكلية</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-sm">تعليمات التصحيح:</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>تأكد من أن ورقة الإجابة مستوية وواضحة</li>
              <li>وجّه الكاميرا بحيث تظهر العلامات السوداء الأربع في الزوايا</li>
              <li>التقط الصورة ثم راجع الإجابات المكتشفة</li>
              <li>يمكنك تعديل أي إجابة يدوياً قبل التسليم</li>
            </ol>
          </div>

          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full" onClick={() => setStep('camera')}>
              <Camera className="h-5 w-5 ml-2" /> فتح الكاميرا
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <ImageIcon className="h-5 w-5 ml-2" /> رفع صورة من الجهاز
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

