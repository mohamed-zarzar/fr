import { APP_CONFIG } from '@/config';
import { apiClient } from '@/lib/api-client';
import {
  buildQuery,
  unwrapPaginated,
  unwrapResponse,
  unwrapVoid,
} from './api';
import type { ApiResponse, PaginatedResponse, PaginationParams } from '@/types';
import type { Unit, Lesson, Question, Exam, ExamAttempt, ExamConfig, ExternalExam, ExternalExamAttempt } from '@/types/exam';

const delay = () => new Promise(r => setTimeout(r, APP_CONFIG.MOCK_DELAY));
let idCounter = 500;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;

// In-memory stores
let units: Unit[] = [
  { id: 'unit-1', name: 'Basic Operations', subjectId: 'sub-1', levelId: 'lvl-1', order: 1, createdAt: '2024-01-01' },
  { id: 'unit-2', name: 'Advanced Arithmetic', subjectId: 'sub-1', levelId: 'lvl-1', order: 2, createdAt: '2024-01-01' },
  { id: 'unit-3', name: 'Language Foundations', subjectId: 'sub-2', levelId: 'lvl-1', order: 1, createdAt: '2024-01-01' },
  { id: 'unit-4', name: 'Algebra Fundamentals', subjectId: 'sub-1', levelId: 'lvl-2', order: 1, createdAt: '2024-01-01' },
];

let lessons: Lesson[] = [
  { id: 'les-1', name: 'Addition & Subtraction', description: 'Basic arithmetic operations', subjectId: 'sub-1', levelId: 'lvl-1', unitId: 'unit-1', order: 1, createdAt: '2024-01-01' },
  { id: 'les-2', name: 'Multiplication', description: 'Multiplication tables and methods', subjectId: 'sub-1', levelId: 'lvl-1', unitId: 'unit-1', order: 2, createdAt: '2024-01-01' },
  { id: 'les-3', name: 'Grammar Basics', description: 'Parts of speech and sentence structure', subjectId: 'sub-2', levelId: 'lvl-1', unitId: 'unit-3', order: 1, createdAt: '2024-01-01' },
  { id: 'les-4', name: 'Algebra Intro', description: 'Introduction to algebraic expressions', subjectId: 'sub-1', levelId: 'lvl-2', unitId: 'unit-4', order: 1, createdAt: '2024-01-01' },
];

let questions: Question[] = [
  { id: 'q-1', lessonId: 'les-1', text: '5 + 3 = 8', type: 'true_false', difficulty: 'easy', options: [{ id: 'o-1', text: 'True' }, { id: 'o-2', text: 'False' }], correctAnswerId: 'o-1', createdAt: '2024-01-01' },
  { id: 'q-2', lessonId: 'les-1', text: 'What is 12 - 7?', type: 'multiple_choice', difficulty: 'easy', options: [{ id: 'o-3', text: '4' }, { id: 'o-4', text: '5' }, { id: 'o-5', text: '6' }, { id: 'o-6', text: '7' }], correctAnswerId: 'o-4', createdAt: '2024-01-01' },
  { id: 'q-3', lessonId: 'les-1', text: '15 + 27 = 43', type: 'true_false', difficulty: 'medium', options: [{ id: 'o-7', text: 'True' }, { id: 'o-8', text: 'False' }], correctAnswerId: 'o-8', createdAt: '2024-01-01' },
  { id: 'q-4', lessonId: 'les-2', text: 'What is 6 × 7?', type: 'multiple_choice', difficulty: 'medium', options: [{ id: 'o-9', text: '36' }, { id: 'o-10', text: '42' }, { id: 'o-11', text: '48' }, { id: 'o-12', text: '49' }], correctAnswerId: 'o-10', createdAt: '2024-01-01' },
  { id: 'q-5', lessonId: 'les-3', text: 'A noun is a person, place, or thing.', type: 'true_false', difficulty: 'easy', options: [{ id: 'o-13', text: 'True' }, { id: 'o-14', text: 'False' }], correctAnswerId: 'o-13', createdAt: '2024-01-01' },
  { id: 'q-6', lessonId: 'les-4', text: 'Solve: 2x = 10, x = ?', type: 'multiple_choice', difficulty: 'medium', options: [{ id: 'o-15', text: '3' }, { id: 'o-16', text: '5' }, { id: 'o-17', text: '7' }, { id: 'o-18', text: '10' }], correctAnswerId: 'o-16', createdAt: '2024-01-01' },
];

let exams: Exam[] = [];
let attempts: ExamAttempt[] = [];
let externalExams: ExternalExam[] = [];
let externalAttempts: ExternalExamAttempt[] = [];

function searchFilter<T extends Record<string, any>>(items: T[], search?: string): T[] {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter(item =>
    Object.values(item).some(val => typeof val === 'string' && val.toLowerCase().includes(q))
  );
}

// ── Unit API (mock) ──
const mockUnitApi = {
  getAll: async (params: { subjectId?: string; levelId?: string }): Promise<ApiResponse<Unit[]>> => {
    await delay();
    let items = [...units];
    if (params.subjectId) items = items.filter(u => u.subjectId === params.subjectId);
    if (params.levelId) items = items.filter(u => u.levelId === params.levelId);
    items.sort((a, b) => a.order - b.order);
    return { data: items, message: 'Success', success: true, statusCode: 200 };
  },
  create: async (data: Omit<Unit, 'id' | 'createdAt'>): Promise<ApiResponse<Unit>> => {
    await delay();
    // Shift orders if inserting at existing position
    const sameScope = units.filter(u => u.subjectId === data.subjectId && u.levelId === data.levelId);
    sameScope.filter(u => u.order >= data.order).forEach(u => {
      const idx = units.findIndex(x => x.id === u.id);
      if (idx !== -1) units[idx] = { ...units[idx], order: units[idx].order + 1 };
    });
    const newItem: Unit = { ...data, id: genId('unit'), createdAt: new Date().toISOString() };
    units = [...units, newItem];
    return { data: newItem, message: 'Unit created', success: true, statusCode: 201 };
  },
  update: async (id: string, data: Partial<Unit>): Promise<ApiResponse<Unit>> => {
    await delay();
    const idx = units.findIndex(u => u.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    const oldUnit = units[idx];
    // Handle order shifting
    if (data.order !== undefined && data.order !== oldUnit.order) {
      const sameScope = units.filter(u => u.subjectId === oldUnit.subjectId && u.levelId === oldUnit.levelId && u.id !== id);
      const sorted = [...sameScope].sort((a, b) => a.order - b.order);
      // Remove the current unit from the list, then insert at new position
      const reordered = sorted.filter(u => u.id !== id);
      const insertAt = Math.max(0, Math.min(data.order - 1, reordered.length));
      reordered.splice(insertAt, 0, { ...oldUnit, ...data } as Unit);
      reordered.forEach((u, i) => {
        const uidx = units.findIndex(x => x.id === u.id);
        if (uidx !== -1) units[uidx] = { ...units[uidx], order: i + 1 };
      });
    } else {
      units[idx] = { ...units[idx], ...data };
    }
    units = [...units];
    return { data: units[units.findIndex(u => u.id === id)], message: 'Updated', success: true, statusCode: 200 };
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    units = units.filter(u => u.id !== id);
    // Move lessons in this unit to no unit
    lessons = lessons.map(l => l.unitId === id ? { ...l, unitId: '' } : l);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  reorder: async (unitIds: string[]): Promise<ApiResponse<null>> => {
    await delay();
    unitIds.forEach((id, idx) => {
      const u = units.find(u => u.id === id);
      if (u) u.order = idx + 1;
    });
    units = [...units];
    return { data: null, message: 'Reordered', success: true, statusCode: 200 };
  },
};

// ── Lesson API (mock) ──
const mockLessonApi = {
  getAll: async (params: PaginationParams & { subjectId?: string; levelId?: string; unitId?: string }): Promise<PaginatedResponse<Lesson>> => {
    await delay();
    let items = [...lessons];
    if (params.subjectId) items = items.filter(l => l.subjectId === params.subjectId);
    if (params.levelId) items = items.filter(l => l.levelId === params.levelId);
    if (params.unitId) items = items.filter(l => l.unitId === params.unitId);
    items = searchFilter(items, params.search);
    items.sort((a, b) => a.order - b.order);
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    return { data: items.slice(start, start + params.limit), total, page: params.page, limit: params.limit, totalPages, message: 'Success', success: true, statusCode: 200 };
  },
  getAllFlat: async (): Promise<ApiResponse<Lesson[]>> => {
    await delay();
    return { data: [...lessons], message: 'Success', success: true, statusCode: 200 };
  },
  getBySubjectAndLevel: async (subjectId: string, levelId: string): Promise<ApiResponse<Lesson[]>> => {
    await delay();
    const items = lessons.filter(l => l.subjectId === subjectId && l.levelId === levelId).sort((a, b) => a.order - b.order);
    return { data: items, message: 'Success', success: true, statusCode: 200 };
  },
  getById: async (id: string): Promise<ApiResponse<Lesson | null>> => {
    await delay();
    const item = lessons.find(l => l.id === id) || null;
    return { data: item, message: item ? 'Success' : 'Not found', success: !!item, statusCode: item ? 200 : 404 };
  },
  create: async (data: Omit<Lesson, 'id' | 'createdAt'>): Promise<ApiResponse<Lesson>> => {
    await delay();
    // Shift orders if inserting at existing position
    const sameScopeLesson = lessons.filter(l => l.subjectId === data.subjectId && l.levelId === data.levelId && l.unitId === data.unitId);
    sameScopeLesson.filter(l => l.order >= data.order).forEach(l => {
      const idx = lessons.findIndex(x => x.id === l.id);
      if (idx !== -1) lessons[idx] = { ...lessons[idx], order: lessons[idx].order + 1 };
    });
    const newItem: Lesson = { ...data, id: genId('les'), createdAt: new Date().toISOString() };
    lessons = [...lessons, newItem];
    return { data: newItem, message: 'Lesson created', success: true, statusCode: 201 };
  },
  update: async (id: string, data: Partial<Lesson>): Promise<ApiResponse<Lesson>> => {
    await delay();
    const idx = lessons.findIndex(l => l.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    const oldLesson = lessons[idx];
    // Handle order shifting
    if (data.order !== undefined && data.order !== oldLesson.order) {
      const sameScope = lessons.filter(l => l.subjectId === oldLesson.subjectId && l.levelId === oldLesson.levelId && l.unitId === oldLesson.unitId && l.id !== id);
      const sorted = [...sameScope].sort((a, b) => a.order - b.order);
      const insertAt = Math.max(0, Math.min(data.order - 1, sorted.length));
      sorted.splice(insertAt, 0, { ...oldLesson, ...data } as Lesson);
      sorted.forEach((l, i) => {
        const lidx = lessons.findIndex(x => x.id === l.id);
        if (lidx !== -1) lessons[lidx] = { ...lessons[lidx], order: i + 1 };
      });
    } else {
      lessons[idx] = { ...lessons[idx], ...data };
    }
    lessons = [...lessons];
    return { data: lessons[lessons.findIndex(l => l.id === id)], message: 'Updated', success: true, statusCode: 200 };
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    lessons = lessons.filter(l => l.id !== id);
    questions = questions.filter(q => q.lessonId !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  reorder: async (lessonIds: string[]): Promise<ApiResponse<null>> => {
    await delay();
    lessonIds.forEach((id, idx) => {
      const l = lessons.find(l => l.id === id);
      if (l) l.order = idx + 1;
    });
    lessons = [...lessons];
    return { data: null, message: 'Reordered', success: true, statusCode: 200 };
  },
  moveToUnit: async (lessonId: string, newUnitId: string, targetLessonIds: string[]): Promise<ApiResponse<null>> => {
    await delay();
    const idx = lessons.findIndex(l => l.id === lessonId);
    if (idx !== -1) {
      lessons[idx] = { ...lessons[idx], unitId: newUnitId };
    }
    // Reorder lessons in the target container
    targetLessonIds.forEach((id, i) => {
      const l = lessons.find(l => l.id === id);
      if (l) l.order = i + 1;
    });
    lessons = [...lessons];
    return { data: null, message: 'Moved', success: true, statusCode: 200 };
  },
};

// ── Question API (mock) ──
const mockQuestionApi = {
  getAll: async (params: PaginationParams & { lessonId?: string; difficulty?: string }): Promise<PaginatedResponse<Question>> => {
    await delay();
    let items = [...questions];
    if (params.lessonId) items = items.filter(q => q.lessonId === params.lessonId);
    if (params.difficulty) items = items.filter(q => q.difficulty === params.difficulty);
    items = searchFilter(items, params.search);
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    return { data: items.slice(start, start + params.limit), total, page: params.page, limit: params.limit, totalPages, message: 'Success', success: true, statusCode: 200 };
  },
  getByLessonIds: async (lessonIds: string[]): Promise<ApiResponse<Question[]>> => {
    await delay();
    const items = questions.filter(q => lessonIds.includes(q.lessonId));
    return { data: items, message: 'Success', success: true, statusCode: 200 };
  },
  create: async (data: Omit<Question, 'id' | 'createdAt'>): Promise<ApiResponse<Question>> => {
    await delay();
    const newItem: Question = { ...data, id: genId('q'), createdAt: new Date().toISOString() };
    questions = [...questions, newItem];
    return { data: newItem, message: 'Question created', success: true, statusCode: 201 };
  },
  update: async (id: string, data: Partial<Question>): Promise<ApiResponse<Question>> => {
    await delay();
    const idx = questions.findIndex(q => q.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    questions[idx] = { ...questions[idx], ...data };
    questions = [...questions];
    return { data: questions[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    questions = questions.filter(q => q.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
};

// ── Exam API (mock) ──
const mockExamApi = {
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Exam>> => {
    await delay();
    let items = searchFilter([...exams], params.search);
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    return { data: items.slice(start, start + params.limit), total, page: params.page, limit: params.limit, totalPages, message: 'Success', success: true, statusCode: 200 };
  },
  getById: async (id: string): Promise<ApiResponse<Exam | null>> => {
    await delay();
    const item = exams.find(e => e.id === id) || null;
    return { data: item, message: item ? 'Success' : 'Not found', success: !!item, statusCode: item ? 200 : 404 };
  },
  generate: async (config: ExamConfig): Promise<ApiResponse<Exam>> => {
    await delay();
    let selectedQuestionIds: string[] = [];
    if (config.mode === 'manual' && config.questionIds) {
      selectedQuestionIds = config.questionIds;
    } else if (config.mode === 'auto') {
      const pool = questions.filter(q => config.lessonIds.includes(q.lessonId));
      const pick = (arr: Question[], count: number) => {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count).map(q => q.id);
      };
      selectedQuestionIds = [
        ...pick(pool.filter(q => q.difficulty === 'easy'), config.easyCount || 0),
        ...pick(pool.filter(q => q.difficulty === 'medium'), config.mediumCount || 0),
        ...pick(pool.filter(q => q.difficulty === 'hard'), config.hardCount || 0),
      ];
    }
    const exam: Exam = {
      id: genId('exam'),
      name: config.name,
      levelId: config.levelId,
      subjectId: config.subjectId,
      lessonIds: config.lessonIds,
      questionIds: selectedQuestionIds,
      maxScore: config.maxScore ?? 100,
      createdAt: new Date().toISOString(),
      status: 'published',
    };
    exams = [...exams, exam];
    return { data: exam, message: 'Exam generated', success: true, statusCode: 201 };
  },
  update: async (id: string, data: Partial<Exam>): Promise<ApiResponse<Exam>> => {
    await delay();
    const idx = exams.findIndex(e => e.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    exams[idx] = { ...exams[idx], ...data };
    exams = [...exams];
    return { data: exams[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    exams = exams.filter(e => e.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  getQuestionsForExam: async (examId: string): Promise<ApiResponse<Question[]>> => {
    await delay();
    const exam = exams.find(e => e.id === examId);
    if (!exam) return { data: [], message: 'Exam not found', success: false, statusCode: 404 };
    const examQuestions = questions.filter(q => exam.questionIds.includes(q.id));
    // Preserve the order defined in exam.questionIds
    const ordered = exam.questionIds
      .map(qId => examQuestions.find(q => q.id === qId))
      .filter((q): q is Question => !!q);
    return { data: ordered, message: 'Success', success: true, statusCode: 200 };
  },
};

// ── Attempt API (mock) ──
const mockAttemptApi = {
  submit: async (examId: string, studentId: string, answers: Record<string, string>): Promise<ApiResponse<ExamAttempt>> => {
    await delay();
    const exam = exams.find(e => e.id === examId);
    if (!exam) return { data: null as any, message: 'Exam not found', success: false, statusCode: 404 };
    const examQuestions = questions.filter(q => exam.questionIds.includes(q.id));
    let correct = 0;
    examQuestions.forEach(q => { if (answers[q.id] === q.correctAnswerId) correct++; });
    const attempt: ExamAttempt = { id: genId('att'), examId, studentId, answers, score: correct, totalQuestions: examQuestions.length, completedAt: new Date().toISOString() };
    attempts = [...attempts, attempt];
    return { data: attempt, message: 'Exam submitted', success: true, statusCode: 201 };
  },
  getByExam: async (examId: string): Promise<ApiResponse<ExamAttempt[]>> => {
    await delay();
    return { data: attempts.filter(a => a.examId === examId), message: 'Success', success: true, statusCode: 200 };
  },
  addManual: async (examId: string, studentId: string, score: number): Promise<ApiResponse<ExamAttempt>> => {
    await delay();
    const exam = exams.find(e => e.id === examId);
    if (!exam) return { data: null as any, message: 'Exam not found', success: false, statusCode: 404 };
    const attempt: ExamAttempt = {
      id: genId('att'), examId, studentId, answers: {}, score,
      totalQuestions: exam.questionIds.length, completedAt: new Date().toISOString(),
    };
    attempts = [...attempts, attempt];
    return { data: attempt, message: 'Score added', success: true, statusCode: 201 };
  },
};

// ── External Exam API (mock) ──
const mockExternalExamApi = {
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<ExternalExam>> => {
    await delay();
    let items = searchFilter([...externalExams], params.search);
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    return { data: items.slice(start, start + params.limit), total, page: params.page, limit: params.limit, totalPages, message: 'Success', success: true, statusCode: 200 };
  },
  getById: async (id: string): Promise<ApiResponse<ExternalExam | null>> => {
    await delay();
    const item = externalExams.find(e => e.id === id) || null;
    return { data: item, message: item ? 'Success' : 'Not found', success: !!item, statusCode: item ? 200 : 404 };
  },
  create: async (data: Omit<ExternalExam, 'id' | 'createdAt'>): Promise<ApiResponse<ExternalExam>> => {
    await delay();
    const newItem: ExternalExam = { ...data, id: genId('ext-exam'), createdAt: new Date().toISOString() };
    externalExams = [...externalExams, newItem];
    return { data: newItem, message: 'External exam created', success: true, statusCode: 201 };
  },
  update: async (id: string, data: Partial<ExternalExam>): Promise<ApiResponse<ExternalExam>> => {
    await delay();
    const idx = externalExams.findIndex(e => e.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    externalExams[idx] = { ...externalExams[idx], ...data };
    externalExams = [...externalExams];
    return { data: externalExams[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    externalExams = externalExams.filter(e => e.id !== id);
    externalAttempts = externalAttempts.filter(a => a.externalExamId !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  submitCorrection: async (externalExamId: string, studentId: string, answers: Record<number, string | null>): Promise<ApiResponse<ExternalExamAttempt>> => {
    await delay();
    const exam = externalExams.find(e => e.id === externalExamId);
    if (!exam) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    let correct = 0;
    for (let i = 1; i <= exam.totalQuestions; i++) {
      if (answers[i] && answers[i] === exam.answerKey[i]) correct++;
    }
    const attempt: ExternalExamAttempt = {
      id: genId('ext-att'), externalExamId, studentId, answers, score: correct,
      totalQuestions: exam.totalQuestions, completedAt: new Date().toISOString(),
    };
    externalAttempts = [...externalAttempts, attempt];
    return { data: attempt, message: 'Corrected', success: true, statusCode: 201 };
  },
  getAttempts: async (externalExamId: string): Promise<ApiResponse<ExternalExamAttempt[]>> => {
    await delay();
    return { data: externalAttempts.filter(a => a.externalExamId === externalExamId), message: 'Success', success: true, statusCode: 200 };
  },
  addManualScore: async (externalExamId: string, studentId: string, score: number): Promise<ApiResponse<ExternalExamAttempt>> => {
    await delay();
    const exam = externalExams.find(e => e.id === externalExamId);
    if (!exam) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    const attempt: ExternalExamAttempt = {
      id: genId('ext-att'), externalExamId, studentId, answers: {}, score,
      totalQuestions: exam.totalQuestions, completedAt: new Date().toISOString(),
    };
    externalAttempts = [...externalAttempts, attempt];
    return { data: attempt, message: 'Score added', success: true, statusCode: 201 };
  },
};

// =============================================================================
// Real API: Units + Lessons (talks to NestJS LessonsModule)
// =============================================================================

type BackendUnitRow = {
  id: string;
  name: string;
  subjectId: string;
  levelId: string;
  order: number;
  createdAt: string;
};

type BackendLessonRow = {
  id: string;
  name: string;
  description: string | null;
  subjectId: string;
  levelId: string;
  unitId: string | null;
  order: number;
  createdAt: string;
};

function mapUnit(raw: unknown): Unit {
  const r = raw as BackendUnitRow;
  return {
    id: r.id,
    name: r.name,
    subjectId: r.subjectId,
    levelId: r.levelId,
    order: r.order,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
  };
}

function mapLesson(raw: unknown): Lesson {
  const r = raw as BackendLessonRow;
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    subjectId: r.subjectId,
    levelId: r.levelId,
    unitId: r.unitId ?? '',
    order: r.order,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
  };
}

const realUnitApi = {
  getAll: async (params: { subjectId?: string; levelId?: string }): Promise<ApiResponse<Unit[]>> => {
    const qs = buildQuery({ subjectId: params.subjectId, levelId: params.levelId });
    const res = await apiClient.get(`units${qs}`);
    const out = await unwrapResponse<BackendUnitRow[]>(res);
    return {
      data: Array.isArray(out.data) ? out.data.map(mapUnit) : [],
      message: out.message,
      success: out.success,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Omit<Unit, 'id' | 'createdAt'>): Promise<ApiResponse<Unit>> => {
    const res = await apiClient.post('units', {
      name: data.name,
      subjectId: data.subjectId,
      levelId: data.levelId,
      order: data.order,
    });
    const out = await unwrapResponse<BackendUnitRow>(res);
    if (!out.success || !out.data) {
      return { data: null as unknown as Unit, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapUnit(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  update: async (id: string, data: Partial<Unit>): Promise<ApiResponse<Unit>> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.order !== undefined) body.order = data.order;
    const res = await apiClient.patch(`units/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendUnitRow>(res);
    if (!out.success || !out.data) {
      return { data: null as unknown as Unit, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapUnit(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`units/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  reorder: async (unitIds: string[]): Promise<ApiResponse<null>> => {
    const res = await apiClient.post('units/reorder', { unitIds });
    return unwrapVoid(res);
  },
};

const realLessonApi = {
  getAll: async (params: PaginationParams & { subjectId?: string; levelId?: string; unitId?: string }): Promise<PaginatedResponse<Lesson>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      subjectId: params.subjectId,
      levelId: params.levelId,
      unitId: params.unitId, // '' is dropped by buildQuery; sending '' filters to ungrouped on the API but the page never uses that
    });
    const res = await apiClient.get(`lessons${qs}`);
    return unwrapPaginated<Lesson>(res, mapLesson);
  },

  getAllFlat: async (): Promise<ApiResponse<Lesson[]>> => {
    // Not used by the page in real mode; kept for API parity.
    const res = await apiClient.get('lessons?page=1&limit=100');
    const paginated = await unwrapPaginated<Lesson>(res, mapLesson);
    return {
      data: paginated.data,
      message: paginated.message,
      success: paginated.success,
      statusCode: paginated.statusCode,
    };
  },

  getBySubjectAndLevel: async (subjectId: string, levelId: string): Promise<ApiResponse<Lesson[]>> => {
    const qs = buildQuery({ subjectId, levelId });
    const res = await apiClient.get(`lessons/by-scope${qs}`);
    const out = await unwrapResponse<BackendLessonRow[]>(res);
    return {
      data: Array.isArray(out.data) ? out.data.map(mapLesson) : [],
      message: out.message,
      success: out.success,
      statusCode: out.statusCode,
    };
  },

  getById: async (id: string): Promise<ApiResponse<Lesson | null>> => {
    // Backend has no /lessons/:id; derive from a paginated lookup. Not used by the page.
    const res = await apiClient.get(`lessons?page=1&limit=1`);
    const out = await unwrapPaginated<Lesson>(res, mapLesson);
    const found = out.data.find((l) => l.id === id) ?? null;
    return { data: found, message: out.message, success: !!found, statusCode: found ? 200 : 404 };
  },

  create: async (data: Omit<Lesson, 'id' | 'createdAt'>): Promise<ApiResponse<Lesson>> => {
    const res = await apiClient.post('lessons', {
      name: data.name,
      description: data.description ?? '',
      subjectId: data.subjectId,
      levelId: data.levelId,
      unitId: data.unitId === '' ? null : data.unitId,
      order: data.order,
    });
    const out = await unwrapResponse<BackendLessonRow>(res);
    if (!out.success || !out.data) {
      return { data: null as unknown as Lesson, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapLesson(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  update: async (id: string, data: Partial<Lesson>): Promise<ApiResponse<Lesson>> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.description !== undefined) body.description = data.description;
    if (data.order !== undefined) body.order = data.order;
    if (data.unitId !== undefined) body.unitId = data.unitId === '' ? null : data.unitId;
    const res = await apiClient.patch(`lessons/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendLessonRow>(res);
    if (!out.success || !out.data) {
      return { data: null as unknown as Lesson, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapLesson(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`lessons/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  reorder: async (lessonIds: string[]): Promise<ApiResponse<null>> => {
    const res = await apiClient.post('lessons/reorder', { lessonIds });
    return unwrapVoid(res);
  },

  moveToUnit: async (lessonId: string, newUnitId: string, targetLessonIds: string[]): Promise<ApiResponse<null>> => {
    const res = await apiClient.post(
      `lessons/${encodeURIComponent(lessonId)}/move-to-unit`,
      {
        newUnitId: newUnitId === '' ? null : newUnitId,
        targetOrder: targetLessonIds,
      },
    );
    return unwrapVoid(res);
  },
};

// =============================================================================
// Real API: Questions (talks to NestJS QuestionsModule)
// =============================================================================

type BackendQuestionRow = {
  id: string;
  text: string;
  lessonId: string;
  type: 'true_false' | 'multiple_choice';
  difficulty: 'easy' | 'medium' | 'hard';
  options: Array<{ id: string; text: string }>;
  correctAnswerId: string;
  createdAt: string;
};

function mapQuestion(raw: unknown): Question {
  const r = raw as BackendQuestionRow;
  return {
    id: r.id,
    text: r.text,
    lessonId: r.lessonId,
    type: r.type,
    difficulty: r.difficulty,
    options: Array.isArray(r.options)
      ? r.options.map((o) => ({ id: o.id, text: o.text }))
      : [],
    correctAnswerId: r.correctAnswerId,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
  };
}

const realQuestionApi = {
  getAll: async (
    params: PaginationParams & { lessonId?: string; difficulty?: string },
  ): Promise<PaginatedResponse<Question>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      lessonId: params.lessonId,
      difficulty: params.difficulty,
    });
    const res = await apiClient.get(`questions${qs}`);
    return unwrapPaginated<Question>(res, mapQuestion);
  },

  getByLessonIds: async (lessonIds: string[]): Promise<ApiResponse<Question[]>> => {
    if (!lessonIds.length) {
      return { data: [], message: 'Success', success: true, statusCode: 200 };
    }
    const qs = buildQuery({ lessonIds: lessonIds.join(',') });
    const res = await apiClient.get(`questions/by-lessons${qs}`);
    const out = await unwrapResponse<BackendQuestionRow[]>(res);
    return {
      data: Array.isArray(out.data) ? out.data.map(mapQuestion) : [],
      message: out.message,
      success: out.success,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Omit<Question, 'id' | 'createdAt'>): Promise<ApiResponse<Question>> => {
    const res = await apiClient.post('questions', {
      text: data.text,
      lessonId: data.lessonId,
      type: data.type,
      difficulty: data.difficulty,
      options: data.options,
      correctAnswerId: data.correctAnswerId,
    });
    const out = await unwrapResponse<BackendQuestionRow>(res);
    if (!out.success || !out.data) {
      return { data: null as unknown as Question, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapQuestion(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  update: async (id: string, data: Partial<Question>): Promise<ApiResponse<Question>> => {
    const body: Record<string, unknown> = {};
    if (data.text !== undefined) body.text = data.text;
    if (data.lessonId !== undefined) body.lessonId = data.lessonId;
    if (data.type !== undefined) body.type = data.type;
    if (data.difficulty !== undefined) body.difficulty = data.difficulty;
    if (data.options !== undefined) body.options = data.options;
    if (data.correctAnswerId !== undefined) body.correctAnswerId = data.correctAnswerId;
    const res = await apiClient.patch(`questions/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendQuestionRow>(res);
    if (!out.success || !out.data) {
      return { data: null as unknown as Question, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapQuestion(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`questions/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },
};

// =============================================================================
// Real API: Exams + Attempts + External Exams (talks to NestJS Exams /
// External-Exams modules)
// =============================================================================

type BackendExamRow = {
  id: string;
  name: string;
  levelId: string;
  subjectId: string;
  lessonIds: string[];
  questionIds: string[];
  maxScore: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt?: string;
};

type BackendExamAttemptRow = {
  id: string;
  examId: string;
  studentId: string | null;
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  completedAt: string;
};

type BackendExternalExamRow = {
  id: string;
  name: string;
  totalQuestions: number;
  answerKey: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
};

type BackendExternalAttemptRow = {
  id: string;
  externalExamId: string;
  studentId: string | null;
  answers: Record<string, string | null>;
  score: number;
  totalQuestions: number;
  completedAt: string;
};

function mapExam(raw: unknown): Exam {
  const r = raw as BackendExamRow;
  return {
    id: r.id,
    name: r.name,
    levelId: r.levelId,
    subjectId: r.subjectId,
    lessonIds: Array.isArray(r.lessonIds) ? [...r.lessonIds] : [],
    questionIds: Array.isArray(r.questionIds) ? [...r.questionIds] : [],
    maxScore: r.maxScore,
    status: r.status,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
  };
}

function mapExamAttempt(raw: unknown): ExamAttempt {
  const r = raw as BackendExamAttemptRow;
  const answers: Record<string, string> = {};
  if (r.answers && typeof r.answers === 'object') {
    for (const [k, v] of Object.entries(r.answers)) {
      if (typeof v === 'string') answers[k] = v;
    }
  }
  return {
    id: r.id,
    examId: r.examId,
    studentId: r.studentId ?? '',
    answers,
    score: r.score,
    totalQuestions: r.totalQuestions,
    completedAt: typeof r.completedAt === 'string' ? r.completedAt : '',
  };
}

function coerceNumberKeyedMap<V>(
  raw: Record<string, V> | null | undefined,
): Record<number, V> {
  const out: Record<number, V> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(k);
    if (Number.isInteger(n)) out[n] = v;
  }
  return out;
}

function mapExternalExam(raw: unknown): ExternalExam {
  const r = raw as BackendExternalExamRow;
  return {
    id: r.id,
    name: r.name,
    totalQuestions: r.totalQuestions,
    answerKey: coerceNumberKeyedMap<string>(r.answerKey),
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
  };
}

function mapExternalAttempt(raw: unknown): ExternalExamAttempt {
  const r = raw as BackendExternalAttemptRow;
  return {
    id: r.id,
    externalExamId: r.externalExamId,
    studentId: r.studentId ?? '',
    answers: coerceNumberKeyedMap<string | null>(r.answers),
    score: r.score,
    totalQuestions: r.totalQuestions,
    completedAt: typeof r.completedAt === 'string' ? r.completedAt : '',
  };
}

const realExamApi = {
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Exam>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
    });
    const res = await apiClient.get(`exams${qs}`);
    return unwrapPaginated<Exam>(res, mapExam);
  },

  getById: async (id: string): Promise<ApiResponse<Exam | null>> => {
    const res = await apiClient.get(`exams/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExam(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  generate: async (config: ExamConfig): Promise<ApiResponse<Exam>> => {
    const body: Record<string, unknown> = {
      name: config.name,
      levelId: config.levelId,
      subjectId: config.subjectId,
      lessonIds: config.lessonIds,
      maxScore: config.maxScore ?? 100,
      mode: config.mode,
    };
    if (config.mode === 'auto') {
      body.easyCount = config.easyCount ?? 0;
      body.mediumCount = config.mediumCount ?? 0;
      body.hardCount = config.hardCount ?? 0;
    } else if (config.mode === 'manual') {
      body.questionIds = config.questionIds ?? [];
    }
    const res = await apiClient.post('exams/generate', body);
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null as unknown as Exam, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExam(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  update: async (id: string, data: Partial<Exam>): Promise<ApiResponse<Exam>> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.levelId !== undefined) body.levelId = data.levelId;
    if (data.subjectId !== undefined) body.subjectId = data.subjectId;
    if (data.lessonIds !== undefined) body.lessonIds = data.lessonIds;
    if (data.questionIds !== undefined) body.questionIds = data.questionIds;
    if (data.maxScore !== undefined) body.maxScore = data.maxScore;
    if (data.status !== undefined) body.status = data.status;
    const res = await apiClient.patch(`exams/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null as unknown as Exam, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExam(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`exams/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  getQuestionsForExam: async (examId: string): Promise<ApiResponse<Question[]>> => {
    const res = await apiClient.get(`exams/${encodeURIComponent(examId)}/questions`);
    const out = await unwrapResponse<unknown[]>(res);
    return {
      data: Array.isArray(out.data) ? out.data.map(mapQuestion) : [],
      message: out.message,
      success: out.success,
      statusCode: out.statusCode,
    };
  },
};

const realAttemptApi = {
  submit: async (
    examId: string,
    studentId: string,
    answers: Record<string, string>,
  ): Promise<ApiResponse<ExamAttempt>> => {
    const res = await apiClient.post(
      `exams/${encodeURIComponent(examId)}/attempts`,
      { studentId, answers },
    );
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null as unknown as ExamAttempt, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExamAttempt(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  getByExam: async (examId: string): Promise<ApiResponse<ExamAttempt[]>> => {
    const res = await apiClient.get(`exams/${encodeURIComponent(examId)}/attempts`);
    const out = await unwrapResponse<unknown[]>(res);
    return {
      data: Array.isArray(out.data) ? out.data.map(mapExamAttempt) : [],
      message: out.message,
      success: out.success,
      statusCode: out.statusCode,
    };
  },

  addManual: async (
    examId: string,
    studentId: string,
    score: number,
  ): Promise<ApiResponse<ExamAttempt>> => {
    const res = await apiClient.post(
      `exams/${encodeURIComponent(examId)}/attempts/manual`,
      { studentId, score },
    );
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null as unknown as ExamAttempt, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExamAttempt(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },
};

const realExternalExamApi = {
  getAll: async (
    params: PaginationParams,
  ): Promise<PaginatedResponse<ExternalExam>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
    });
    const res = await apiClient.get(`external-exams${qs}`);
    return unwrapPaginated<ExternalExam>(res, mapExternalExam);
  },

  getById: async (id: string): Promise<ApiResponse<ExternalExam | null>> => {
    const res = await apiClient.get(`external-exams/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExternalExam(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  create: async (
    data: Omit<ExternalExam, 'id' | 'createdAt'>,
  ): Promise<ApiResponse<ExternalExam>> => {
    const body = {
      name: data.name,
      totalQuestions: data.totalQuestions,
      answerKey: data.answerKey,
    };
    const res = await apiClient.post('external-exams', body);
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null as unknown as ExternalExam, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExternalExam(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  update: async (
    id: string,
    data: Partial<ExternalExam>,
  ): Promise<ApiResponse<ExternalExam>> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.totalQuestions !== undefined) body.totalQuestions = data.totalQuestions;
    if (data.answerKey !== undefined) body.answerKey = data.answerKey;
    const res = await apiClient.patch(
      `external-exams/${encodeURIComponent(id)}`,
      body,
    );
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null as unknown as ExternalExam, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExternalExam(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(
      `external-exams/${encodeURIComponent(id)}`,
    );
    return unwrapVoid(res);
  },

  submitCorrection: async (
    externalExamId: string,
    studentId: string,
    answers: Record<number, string | null>,
  ): Promise<ApiResponse<ExternalExamAttempt>> => {
    const res = await apiClient.post(
      `external-exams/${encodeURIComponent(externalExamId)}/correct`,
      { studentId, answers },
    );
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null as unknown as ExternalExamAttempt, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExternalAttempt(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },

  getAttempts: async (
    externalExamId: string,
  ): Promise<ApiResponse<ExternalExamAttempt[]>> => {
    const res = await apiClient.get(
      `external-exams/${encodeURIComponent(externalExamId)}/attempts`,
    );
    const out = await unwrapResponse<unknown[]>(res);
    return {
      data: Array.isArray(out.data) ? out.data.map(mapExternalAttempt) : [],
      message: out.message,
      success: out.success,
      statusCode: out.statusCode,
    };
  },

  addManualScore: async (
    externalExamId: string,
    studentId: string,
    score: number,
  ): Promise<ApiResponse<ExternalExamAttempt>> => {
    const res = await apiClient.post(
      `external-exams/${encodeURIComponent(externalExamId)}/attempts/manual`,
      { studentId, score },
    );
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return { data: null as unknown as ExternalExamAttempt, message: out.message, success: false, statusCode: out.statusCode };
    }
    return { data: mapExternalAttempt(out.data), message: out.message, success: true, statusCode: out.statusCode };
  },
};

// ── Dual-mode exports ──
export const unitApi = APP_CONFIG.USE_MOCK_API ? mockUnitApi : realUnitApi;
export const lessonApi = APP_CONFIG.USE_MOCK_API ? mockLessonApi : realLessonApi;
export const questionApi = APP_CONFIG.USE_MOCK_API ? mockQuestionApi : realQuestionApi;
export const examApi = APP_CONFIG.USE_MOCK_API ? mockExamApi : realExamApi;
export const attemptApi = APP_CONFIG.USE_MOCK_API ? mockAttemptApi : realAttemptApi;
export const externalExamApi = APP_CONFIG.USE_MOCK_API ? mockExternalExamApi : realExternalExamApi;
