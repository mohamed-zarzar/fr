import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { externalExamApi } from '@/services/exam-api';
import { studentApi } from '@/services/api';
import { processAnswerSheet, type OMRResult } from '@/lib/omr-processor';
import { parseExcelFile } from '@/lib/excel-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Trash2, Camera, Upload, Send, ArrowLeft, CheckCircle2, XCircle,
  AlertTriangle, RotateCcw, ImageIcon, FileSpreadsheet, Eye, Edit,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import type { ExternalExam, ExternalExamAttempt } from '@/types/exam';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

type Step = 'list' | 'create' | 'correct' | 'camera' | 'review' | 'result';

export default function ExternalExams() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('list');
  const [selectedExam, setSelectedExam] = useState<ExternalExam | null>(null);
  const [studentId, setStudentId] = useState('');

  const [createName, setCreateName] = useState('');
  const [createCount, setCreateCount] = useState(20);
  const [answerKey, setAnswerKey] = useState<Record<number, string>>({});
  const [createTab, setCreateTab] = useState<'manual' | 'excel'>('manual');

  const [editOpen, setEditOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExternalExam | null>(null);
  const [editName, setEditName] = useState('');
  const [editCount, setEditCount] = useState(20);
  const [editAnswerKey, setEditAnswerKey] = useState<Record<number, string>>({});

  const [omrResult, setOmrResult] = useState<OMRResult | null>(null);
  const [editedAnswers, setEditedAnswers] = useState<Record<number, string | null>>({});
  const [result, setResult] = useState<ExternalExamAttempt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const { data: examsRes, isLoading } = useQuery({
    queryKey: ['external-exams'],
    queryFn: () => externalExamApi.getAll({ page: 1, limit: 100 }),
  });
  const { data: studentsRes } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => studentApi.getAll({ page: 1, limit: 100 }),
  });
  const students = studentsRes?.data ?? [];
  const exams = examsRes?.data ?? [];

  const createMut = useMutation({
    mutationFn: (data: Omit<ExternalExam, 'id' | 'createdAt'>) => externalExamApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-exams'] });
      toast({ title: t('externalExams.examCreated') });
      setStep('list');
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => externalExamApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['external-exams'] }); toast({ title: t('common.delete') }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExternalExam> }) => externalExamApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['external-exams'] }); toast({ title: t('externalExams.examUpdated') }); setEditOpen(false); setEditingExam(null); },
  });
  const submitMut = useMutation({
    mutationFn: ({ examId, answers }: { examId: string; answers: Record<number, string | null> }) =>
      externalExamApi.submitCorrection(examId, studentId, answers),
    onSuccess: (res) => {
      setResult(res.data);
      setStep('result');
      toast({ title: `${t('exams.score')}: ${res.data.score}/${res.data.totalQuestions}` });
    },
  });

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError(t('externalExams.cameraError'));
    }
  }, [t]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (step === 'camera') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !selectedExam) return;
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      const result = await processAnswerSheet(canvas, selectedExam.totalQuestions);
      setOmrResult(result);
      setEditedAnswers({ ...result.answers });
      setStep('review');
    } catch {
      toast({ title: t('externalExams.processingFailed'), variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedExam, toast, t]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExam) return;
    setIsProcessing(true);
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
      const result = await processAnswerSheet(img, selectedExam.totalQuestions);
      setOmrResult(result);
      setEditedAnswers({ ...result.answers });
      setStep('review');
      URL.revokeObjectURL(img.src);
    } catch {
      toast({ title: t('externalExams.imageProcessingFailed'), variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [selectedExam, toast, t]);

  const handleAnswerEdit = (qNum: number, option: string | null) => {
    setEditedAnswers(prev => ({ ...prev, [qNum]: prev[qNum] === option ? null : option }));
  };

  const handleSubmitCorrection = () => {
    if (!studentId) { toast({ title: t('externalExams.selectStudentError'), variant: 'destructive' }); return; }
    if (!selectedExam) return;
    submitMut.mutate({ examId: selectedExam.id, answers: editedAnswers });
  };

  const handleCreateExam = () => {
    if (!createName.trim()) { toast({ title: t('exams.enterExamName'), variant: 'destructive' }); return; }
    if (createCount < 1) { toast({ title: t('externalExams.atLeastOneQuestion'), variant: 'destructive' }); return; }
    const keyCount = Object.keys(answerKey).length;
    if (keyCount < createCount) { toast({ title: t('externalExams.setAnswers') + ` (${keyCount}/${createCount})`, variant: 'destructive' }); return; }
    createMut.mutate({ name: createName, totalQuestions: createCount, answerKey });
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseExcelFile(file);
      const key: Record<number, string> = {};
      rows.forEach(row => {
        const num = parseInt(row['Question'] || row['question'] || row['#'] || '');
        const answer = (row['Answer'] || row['answer'] || row['Correct Answer'] || '').toUpperCase().trim();
        if (num && OPTION_LABELS.includes(answer)) key[num] = answer;
      });
      const maxQ = Math.max(...Object.keys(key).map(Number), 0);
      if (maxQ > 0) {
        setAnswerKey(key);
        setCreateCount(maxQ);
        toast({ title: t('externalExams.importedAnswers', { count: Object.keys(key).length }) });
      } else {
        toast({ title: t('externalExams.noAnswersFound'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('externalExams.failedParse'), variant: 'destructive' });
    }
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  const openCorrect = (exam: ExternalExam) => {
    setSelectedExam(exam);
    setStudentId('');
    setEditedAnswers({});
    setOmrResult(null);
    setResult(null);
    setStep('correct');
  };

  const openCreate = () => {
    setCreateName('');
    setCreateCount(20);
    setAnswerKey({});
    setStep('create');
  };

  const openEditExam = (exam: ExternalExam) => {
    setEditingExam(exam);
    setEditName(exam.name);
    setEditCount(exam.totalQuestions);
    setEditAnswerKey({ ...exam.answerKey });
    setEditOpen(true);
  };

  const handleUpdateExam = () => {
    if (!editingExam || !editName.trim()) return;
    updateMut.mutate({ id: editingExam.id, data: { name: editName, totalQuestions: editCount, answerKey: editAnswerKey } });
  };

  // ── Result View ──
  if (step === 'result' && result && selectedExam) {
    const pct = Math.round((result.score / result.totalQuestions) * 100);
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setStep('list')}><ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}</Button>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('externalExams.correctionResults')}</CardTitle>
            <CardDescription>{selectedExam.name}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-5xl font-bold text-primary">{pct}%</div>
            <p className="text-lg text-foreground">{result.score} / {result.totalQuestions} {t('externalExams.correct').toLowerCase()}</p>
            <Progress value={pct} className="h-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-4" dir="ltr">
              {Array.from({ length: result.totalQuestions }, (_, i) => i + 1).map(qNum => {
                const studentAnswer = result.answers[qNum];
                const correctAnswer = selectedExam.answerKey[qNum];
                const isCorrect = studentAnswer === correctAnswer;
                return (
                  <div key={qNum} className={`border rounded-md p-2 text-center ${isCorrect ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-red-300 bg-red-50 dark:bg-red-950/20'}`}>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {isCorrect ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                      <span className="text-xs font-bold">Q{qNum}</span>
                    </div>
                    <div className="text-xs">
                      {studentAnswer || '—'} {!isCorrect && <span className="text-green-600">({correctAnswer})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button className="mt-4" onClick={() => setStep('list')}>{t('externalExams.backToExams')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Review View ──
  if (step === 'review' && selectedExam) {
    const answeredCount = Object.values(editedAnswers).filter(v => v !== null).length;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setStep('camera')}><ArrowLeft className="h-4 w-4 mr-2" /> {t('externalExams.retake')}</Button>
        <Card>
          <CardHeader>
            <CardTitle>{t('externalExams.reviewAnswers')} - {selectedExam.name}</CardTitle>
            <CardDescription>{answeredCount} {t('common.of')} {selectedExam.totalQuestions} {t('externalExams.detected')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {omrResult && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{t('externalExams.detectionAccuracy')}:</span>
                <Progress value={omrResult.confidence * 100} className="flex-1 h-2" />
                <span className="text-sm text-muted-foreground">{Math.round(omrResult.confidence * 100)}%</span>
              </div>
            )}
            <div>
              <Label>{t('common.selectStudent')} *</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder={t('externalExams.selectStudent')} /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstname} {s.lastname}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" dir="ltr">
              {Array.from({ length: selectedExam.totalQuestions }, (_, i) => i + 1).map(qNum => {
                const isFlagged = omrResult?.flaggedQuestions.includes(qNum);
                const sel = editedAnswers[qNum];
                return (
                  <div key={qNum} className={`border rounded-md p-2 ${isFlagged ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">Q{qNum}</span>
                      {isFlagged && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                    </div>
                    <div className="flex gap-1">
                      {OPTION_LABELS.map(opt => (
                        <button key={opt} onClick={() => handleAnswerEdit(qNum, opt)}
                          className={`w-7 h-7 rounded-full border text-xs font-bold transition-colors ${sel === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30 hover:border-primary/50'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('camera')}><RotateCcw className="h-4 w-4 mr-2" /> {t('externalExams.retake')}</Button>
              <Button onClick={handleSubmitCorrection} disabled={submitMut.isPending || !studentId} size="lg">
                <Send className="h-4 w-4 mr-2" /> {t('externalExams.submitGrade')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Camera View ──
  if (step === 'camera' && selectedExam) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => { stopCamera(); setStep('correct'); }}><ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}</Button>
        <Card>
          <CardHeader>
            <CardTitle>{t('externalExams.scanAnswerSheet')}</CardTitle>
            <CardDescription>{t('externalExams.pointCamera')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameraError ? (
              <div className="text-center py-8 space-y-3">
                <XCircle className="h-10 w-10 text-destructive mx-auto" />
                <p className="text-sm text-destructive">{cameraError}</p>
                <Button variant="outline" onClick={startCamera}>{t('common.retry')}</Button>
              </div>
            ) : (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full" style={{ maxHeight: '60vh' }} />
                <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-lg pointer-events-none" />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-3 justify-center flex-wrap">
              <Button size="lg" onClick={captureAndProcess} disabled={isProcessing || !!cameraError}>
                {isProcessing ? t('common.processing') : <><Camera className="h-4 w-4 mr-2" /> {t('common.capture')}</>}
              </Button>
              <Button variant="outline" size="lg" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                <Upload className="h-4 w-4 mr-2" /> {t('externalExams.uploadImage')}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Correct Setup View ──
  if (step === 'correct' && selectedExam) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setStep('list')}><ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}</Button>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t('externalExams.correct')}: {selectedExam.name}</CardTitle>
            <CardDescription>{selectedExam.totalQuestions} {t('exams.questions').toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-primary">{selectedExam.totalQuestions}</p>
                <p className="text-sm text-muted-foreground">{t('exams.questions')}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-2xl font-bold text-primary">{Object.keys(selectedExam.answerKey).length}</p>
                <p className="text-sm text-muted-foreground">{t('externalExams.answerKeySet')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button size="lg" className="w-full" onClick={() => setStep('camera')}>
                <Camera className="h-5 w-5 mr-2" /> {t('externalExams.openCamera')}
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                <ImageIcon className="h-5 w-5 mr-2" /> {t('externalExams.uploadImage')}
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => {
                const answers: Record<number, string | null> = {};
                for (let i = 1; i <= selectedExam.totalQuestions; i++) answers[i] = null;
                setEditedAnswers(answers);
                setOmrResult(null);
                setStep('review');
              }}>
                <Send className="h-5 w-5 mr-2" /> {t('externalExams.manualEntry')}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Create View ──
  if (step === 'create') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setStep('list')}><ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}</Button>
        <Card>
          <CardHeader>
            <CardTitle>{t('externalExams.createExam')}</CardTitle>
            <CardDescription>{t('externalExams.defineAnswerKey')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('exams.examName')} *</Label>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Math Final Exam" />
            </div>
            <div>
              <Label>{t('externalExams.numberOfQuestions')} *</Label>
              <Input type="number" min={1} max={200} value={createCount} onChange={e => {
                const v = parseInt(e.target.value) || 1;
                setCreateCount(v);
              }} />
            </div>

            <Tabs value={createTab} onValueChange={v => setCreateTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="manual" className="flex-1">{t('externalExams.manualEntry')}</TabsTrigger>
                <TabsTrigger value="excel" className="flex-1">{t('externalExams.importAnswers')}</TabsTrigger>
              </TabsList>

              <TabsContent value="excel" className="space-y-3 mt-3">
                <p className="text-sm text-muted-foreground">{t('externalExams.excelHint')}</p>
                <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
                <Button variant="outline" onClick={() => excelInputRef.current?.click()}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> {t('externalExams.selectFile')}
                </Button>
                {Object.keys(answerKey).length > 0 && (
                  <p className="text-sm text-green-600">{t('externalExams.answersLoaded', { count: Object.keys(answerKey).length })}</p>
                )}
              </TabsContent>

              <TabsContent value="manual" className="mt-3">
                <Label>{t('externalExams.answerKey')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2 max-h-[400px] overflow-y-auto" dir="ltr">
                  {Array.from({ length: createCount }, (_, i) => i + 1).map(qNum => (
                    <div key={qNum} className="border rounded-md p-2">
                      <span className="text-xs font-bold block mb-1">Q{qNum}</span>
                      <div className="flex gap-1">
                        {OPTION_LABELS.map(opt => (
                          <button key={opt} onClick={() => setAnswerKey(prev => ({ ...prev, [qNum]: opt }))}
                            className={`w-7 h-7 rounded-full border text-xs font-bold transition-colors ${answerKey[qNum] === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30 hover:border-primary/50'}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t('externalExams.answersSet', { set: Object.keys(answerKey).length, total: createCount })}</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setStep('list')}>{t('common.cancel')}</Button>
          <Button onClick={handleCreateExam} disabled={createMut.isPending}>
            {createMut.isPending ? t('externalExams.creating') : t('externalExams.createExam')}
          </Button>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('externalExams.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('externalExams.correctSubtitle')}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {t('externalExams.newExternalExam')}</Button>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('exams.questions')}</TableHead>
                <TableHead>{t('common.created')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              ) : exams.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t('externalExams.noExternalExams')}</TableCell></TableRow>
              ) : exams.map(exam => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.name}</TableCell>
                  <TableCell><Badge variant="secondary">{exam.totalQuestions}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(exam.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/external-exams/${exam.id}`)} title={t('common.view')}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditExam(exam)} title={t('common.edit')}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openCorrect(exam)} title={t('externalExams.correct')}><Camera className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(exam.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit External Exam Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('externalExams.editExternalExam')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('exams.examName')} *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>{t('externalExams.numberOfQuestions')} *</Label>
              <Input type="number" min={1} max={200} value={editCount} onChange={e => setEditCount(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>{t('externalExams.answerKey')}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2 max-h-[400px] overflow-y-auto" dir="ltr">
                {Array.from({ length: editCount }, (_, i) => i + 1).map(qNum => (
                  <div key={qNum} className="border rounded-md p-2">
                    <span className="text-xs font-bold block mb-1">Q{qNum}</span>
                    <div className="flex gap-1">
                      {OPTION_LABELS.map(opt => (
                        <button key={opt} onClick={() => setEditAnswerKey(prev => ({ ...prev, [qNum]: opt }))}
                          className={`w-7 h-7 rounded-full border text-xs font-bold transition-colors ${editAnswerKey[qNum] === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30 hover:border-primary/50'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t('externalExams.answersSet', { set: Object.keys(editAnswerKey).filter(k => Number(k) <= editCount).length, total: editCount })}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleUpdateExam} disabled={updateMut.isPending}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
