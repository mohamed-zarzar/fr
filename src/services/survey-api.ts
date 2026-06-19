import { APP_CONFIG } from '@/config';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type {
  Survey,
  SurveyNote,
  SurveyOption,
  SurveyQuestion,
  SurveyResponse,
} from '@/types/survey';
import { buildQuery, unwrapPaginated, unwrapResponse, unwrapVoid } from './api';

// ─── Mock implementation ─────────────────────────────────────────────────────

const delay = () => new Promise((r) => setTimeout(r, APP_CONFIG.MOCK_DELAY));
let idCounter = 900;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;

let mockSurveys: Survey[] = [
  {
    id: 'srv-1',
    title: 'Student Satisfaction Survey',
    targetType: 'class',
    targetIds: ['cls-1'],
    distribution: 'student_app',
    questions: [
      { id: 'sq-1', type: 'multiple_choice', text: 'How do you rate the teaching quality?', options: [{ id: 'o1', text: 'Excellent' }, { id: 'o2', text: 'Good' }, { id: 'o3', text: 'Average' }, { id: 'o4', text: 'Poor' }], order: 1 },
      { id: 'sq-2', type: 'rating', text: 'Rate your overall experience', order: 2 },
      { id: 'sq-3', type: 'text', text: 'What improvements would you suggest?', order: 3 },
      { id: 'sq-4', type: 'pros_cons', text: 'List the pros and cons of the current curriculum', order: 4 },
    ],
    notes: [
      { id: 'sn-1', text: 'Please answer all questions honestly. Your responses are anonymous.', color: 'info', position: 'beginning' },
      { id: 'sn-2', text: 'This survey will close on Friday.', color: 'warn', position: 'end' },
    ],
    status: 'active',
    createdAt: '2025-03-01T10:00:00Z',
    responsesCount: 12,
  },
  {
    id: 'srv-2',
    title: 'End of Term Feedback',
    targetType: 'level',
    targetIds: ['lvl-1'],
    distribution: 'link',
    questions: [
      { id: 'sq-5', type: 'rating', text: 'Rate the difficulty of exams', order: 1 },
      { id: 'sq-6', type: 'text', text: 'Any additional comments?', order: 2 },
    ],
    notes: [],
    status: 'draft',
    createdAt: '2025-03-05T08:00:00Z',
    responsesCount: 0,
  },
];

let mockResponses: SurveyResponse[] = [
  { id: 'sr-1', surveyId: 'srv-1', studentId: 'stu-1', answers: { 'sq-1': 'o1', 'sq-2': 8, 'sq-3': 'More labs', 'sq-4': { pros: ['Great teachers'], cons: ['Too much homework'] } }, submittedAt: '2025-03-02T14:00:00Z' },
];

const mockSurveyApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<Survey[]>> => {
    await delay();
    let items = [...mockSurveys];
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter((s) => s.title.toLowerCase().includes(q));
    }
    return { data: items, message: 'Success', success: true, statusCode: 200 };
  },

  getById: async (id: string): Promise<ApiResponse<Survey>> => {
    await delay();
    const item = mockSurveys.find((s) => s.id === id);
    if (!item) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    return { data: { ...item }, message: 'Success', success: true, statusCode: 200 };
  },

  create: async (data: Omit<Survey, 'id' | 'createdAt' | 'responsesCount'>): Promise<ApiResponse<Survey>> => {
    await delay();
    const survey: Survey = {
      ...data,
      id: genId('srv'),
      createdAt: new Date().toISOString(),
      responsesCount: 0,
    };
    mockSurveys = [...mockSurveys, survey];
    return { data: survey, message: 'Survey created', success: true, statusCode: 201 };
  },

  update: async (id: string, data: Partial<Survey>): Promise<ApiResponse<Survey>> => {
    await delay();
    const idx = mockSurveys.findIndex((s) => s.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    mockSurveys[idx] = { ...mockSurveys[idx], ...data };
    mockSurveys = [...mockSurveys];
    return { data: mockSurveys[idx], message: 'Updated', success: true, statusCode: 200 };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    mockSurveys = mockSurveys.filter((s) => s.id !== id);
    mockResponses = mockResponses.filter((r) => r.surveyId !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },

  getResponses: async (surveyId: string): Promise<ApiResponse<SurveyResponse[]>> => {
    await delay();
    return { data: mockResponses.filter((r) => r.surveyId === surveyId), message: 'Success', success: true, statusCode: 200 };
  },

  submitResponse: async (data: Omit<SurveyResponse, 'id' | 'submittedAt'>): Promise<ApiResponse<SurveyResponse>> => {
    await delay();
    const resp: SurveyResponse = { ...data, id: genId('sr'), submittedAt: new Date().toISOString() };
    mockResponses = [...mockResponses, resp];
    const sIdx = mockSurveys.findIndex((s) => s.id === data.surveyId);
    if (sIdx !== -1) mockSurveys[sIdx] = { ...mockSurveys[sIdx], responsesCount: mockSurveys[sIdx].responsesCount + 1 };
    return { data: resp, message: 'Response submitted', success: true, statusCode: 201 };
  },
};

// ─── Real API implementation ─────────────────────────────────────────────────

type BackendSurveyOption = { id: unknown; text: unknown };

type BackendSurvey = {
  id: string;
  title: string;
  targetType: string;
  targetIds: string[];
  distribution: string;
  status: string;
  questions: Array<{
    id: string;
    type: string;
    text: string;
    order: number;
    options?: BackendSurveyOption[] | null;
  }>;
  notes: Array<{
    id: string;
    text: string;
    color: string;
    position: string;
  }>;
  responsesCount: number;
  createdAt: string;
  updatedAt: string;
};

type BackendSurveyResponse = {
  id: string;
  surveyId: string;
  studentId: string | null;
  answers: Record<string, unknown>;
  submittedAt: string;
};

function mapSurvey(raw: unknown): Survey {
  const r = raw as BackendSurvey;
  return {
    id: r.id,
    title: r.title,
    targetType: r.targetType as Survey['targetType'],
    targetIds: Array.isArray(r.targetIds) ? r.targetIds : [],
    distribution: r.distribution as Survey['distribution'],
    status: r.status as Survey['status'],
    questions: (r.questions ?? []).map<SurveyQuestion>((q) => ({
      id: q.id,
      type: q.type as SurveyQuestion['type'],
      text: q.text,
      order: q.order,
      ...(Array.isArray(q.options) && q.options.length > 0
        ? {
            options: q.options.map<SurveyOption>((o) => ({
              id: String(o.id),
              text: String(o.text),
            })),
          }
        : {}),
    })),
    notes: (r.notes ?? []).map<SurveyNote>((n) => ({
      id: n.id,
      text: n.text,
      color: n.color as SurveyNote['color'],
      position: n.position as SurveyNote['position'],
    })),
    responsesCount: r.responsesCount ?? 0,
    createdAt: r.createdAt,
  };
}

function mapResponse(raw: unknown): SurveyResponse {
  const r = raw as BackendSurveyResponse;
  return {
    id: r.id,
    surveyId: r.surveyId,
    answers: r.answers ?? {},
    submittedAt: r.submittedAt,
    ...(r.studentId ? { studentId: r.studentId } : {}),
  };
}

function stripIds<T extends { id?: string }>(items: T[]): Omit<T, 'id'>[] {
  return items.map((it) => {
    const { id: _omit, ...rest } = it;
    void _omit;
    return rest;
  });
}

function buildSurveyPayload(
  data: Omit<Survey, 'id' | 'createdAt' | 'responsesCount'> | Partial<Survey>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.title !== undefined) out.title = data.title;
  if (data.targetType !== undefined) out.targetType = data.targetType;
  if (data.targetIds !== undefined) out.targetIds = data.targetIds;
  if (data.distribution !== undefined) out.distribution = data.distribution;
  if (data.status !== undefined) out.status = data.status;
  if (data.questions !== undefined) {
    out.questions = data.questions.map((q) => {
      const base: Record<string, unknown> = {
        type: q.type,
        text: q.text,
        order: q.order,
      };
      if (q.type === 'multiple_choice' && q.options) {
        base.options = q.options.map((o) => ({ id: o.id, text: o.text }));
      }
      return base;
    });
  }
  if (data.notes !== undefined) {
    out.notes = stripIds(
      data.notes.map((n) => ({
        id: n.id,
        text: n.text,
        color: n.color,
        position: n.position,
      })),
    );
  }
  return out;
}

const realSurveyApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<Survey[]>> => {
    const qs = buildQuery({
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
    });
    const res = await apiClient.get(`surveys${qs}`);
    const out = await unwrapPaginated<Survey>(res, mapSurvey);
    return {
      data: out.data,
      message: out.message,
      success: out.success,
      statusCode: out.statusCode,
    };
  },

  getById: async (id: string): Promise<ApiResponse<Survey>> => {
    const res = await apiClient.get(`surveys/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return {
        data: null as unknown as Survey,
        message: out.message,
        success: false,
        statusCode: out.statusCode,
      };
    }
    return {
      data: mapSurvey(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  create: async (
    data: Omit<Survey, 'id' | 'createdAt' | 'responsesCount'>,
  ): Promise<ApiResponse<Survey>> => {
    const body = buildSurveyPayload(data);
    const res = await apiClient.post('surveys', body);
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return {
        data: null as unknown as Survey,
        message: out.message,
        success: false,
        statusCode: out.statusCode,
      };
    }
    return {
      data: mapSurvey(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  update: async (
    id: string,
    data: Partial<Survey>,
  ): Promise<ApiResponse<Survey>> => {
    const body = buildSurveyPayload(data);
    const res = await apiClient.patch(
      `surveys/${encodeURIComponent(id)}`,
      body,
    );
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return {
        data: null as unknown as Survey,
        message: out.message,
        success: false,
        statusCode: out.statusCode,
      };
    }
    return {
      data: mapSurvey(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`surveys/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  getResponses: async (
    surveyId: string,
  ): Promise<ApiResponse<SurveyResponse[]>> => {
    const res = await apiClient.get(
      `surveys/${encodeURIComponent(surveyId)}/responses`,
    );
    const out = await unwrapResponse<unknown[]>(res);
    if (!out.success || !Array.isArray(out.data)) {
      return {
        data: [],
        message: out.message,
        success: out.success,
        statusCode: out.statusCode,
      };
    }
    return {
      data: out.data.map(mapResponse),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  submitResponse: async (
    data: Omit<SurveyResponse, 'id' | 'submittedAt'>,
  ): Promise<ApiResponse<SurveyResponse>> => {
    const body: Record<string, unknown> = { answers: data.answers };
    if (data.studentId) body.studentId = data.studentId;
    const res = await apiClient.post(
      `surveys/${encodeURIComponent(data.surveyId)}/responses`,
      body,
    );
    const out = await unwrapResponse<unknown>(res);
    if (!out.success || out.data == null) {
      return {
        data: null as unknown as SurveyResponse,
        message: out.message,
        success: false,
        statusCode: out.statusCode,
      };
    }
    return {
      data: mapResponse(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },
};

export const surveyApi = APP_CONFIG.USE_MOCK_API ? mockSurveyApi : realSurveyApi;
