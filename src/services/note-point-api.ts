import { APP_CONFIG } from '@/config';
import { apiClient, parseJson, type ApiWrappedSuccess } from '@/lib/api-client';
import type { ApiResponse, ApprovalStatus } from '@/types';
import type { NoteTemplate, Note, PointRecord } from '@/types/note-point';
import { getApprovalDefaults } from './settings-api';

// ============================================================
// Shared helpers (real API)
// ============================================================

function isWrappedSuccess<T>(body: unknown): body is ApiWrappedSuccess<T> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'statusCode' in body &&
    'data' in body &&
    'message' in body &&
    'error' in body
  );
}

async function unwrapResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const body = await parseJson(response);
  const wrapped = isWrappedSuccess<T>(body) ? body : null;
  const statusCode = wrapped?.statusCode ?? response.status;
  const message =
    wrapped && typeof wrapped.message === 'string'
      ? wrapped.message
      : response.ok ? 'Success' : 'Request failed';
  const success = response.ok && statusCode < 400 && wrapped?.error === null;
  if (!wrapped) return { data: null as T, message, success: false, statusCode };
  return { data: wrapped.data as T, message, success, statusCode };
}

async function unwrapVoid(response: Response): Promise<ApiResponse<null>> {
  const body = await parseJson(response);
  const wrapped = body as { statusCode?: number; message?: string } | null;
  const statusCode = wrapped?.statusCode ?? response.status;
  const message =
    wrapped && typeof wrapped.message === 'string'
      ? wrapped.message
      : response.ok ? 'Success' : 'Request failed';
  const success = response.ok && statusCode < 400;
  return { data: null, message, success, statusCode };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ============================================================
// Mock store
// ============================================================

const delay = () => new Promise(r => setTimeout(r, APP_CONFIG.MOCK_DELAY));
let idCounter = 800;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;

let noteTemplates: NoteTemplate[] = [
  { id: 'ntpl-1', title: 'Good Behavior', type: 'positive', isPointEffect: true, pointEffect: 5, isSendNotification: false, createdAt: '2025-01-01T00:00:00Z' },
  { id: 'ntpl-2', title: 'Homework Not Done', type: 'negative', isPointEffect: true, pointEffect: 3, isSendNotification: true, createdAt: '2025-01-01T00:00:00Z' },
  { id: 'ntpl-3', title: 'Class Participation', type: 'positive', isPointEffect: true, pointEffect: 2, isSendNotification: false, createdAt: '2025-01-02T00:00:00Z' },
  { id: 'ntpl-4', title: 'Disruptive Behavior', type: 'negative', isPointEffect: true, pointEffect: 5, isSendNotification: true, createdAt: '2025-01-02T00:00:00Z' },
  { id: 'ntpl-5', title: 'General Observation', type: 'positive', isPointEffect: false, pointEffect: 0, isSendNotification: false, createdAt: '2025-01-03T00:00:00Z' },
];

let notes: Note[] = [
  { id: 'note-1', templateId: 'ntpl-1', studentId: 'stu-1', date: '2025-02-10', description: 'Helped classmates with math assignment', status: 'APPROVED', createdAt: '2025-02-10T10:00:00Z' },
  { id: 'note-2', templateId: 'ntpl-2', studentId: 'stu-2', date: '2025-02-12', description: 'Did not submit homework', status: 'PENDING', createdAt: '2025-02-12T08:00:00Z' },
  { id: 'note-3', templateId: 'ntpl-2', studentId: 'stu-3', date: '2025-02-12', description: 'Did not submit homework', status: 'PENDING', createdAt: '2025-02-12T08:00:00Z' },
];

let points: PointRecord[] = [
  { id: 'pt-1', studentId: 'stu-1', type: 'positive', amount: 5, date: '2025-02-10', sourceNoteId: 'note-1', createdAt: '2025-02-10T10:00:00Z' },
  { id: 'pt-2', studentId: 'stu-2', type: 'negative', amount: 3, date: '2025-02-12', sourceNoteId: 'note-2', createdAt: '2025-02-12T08:00:00Z' },
  { id: 'pt-3', studentId: 'stu-3', type: 'negative', amount: 3, date: '2025-02-12', sourceNoteId: 'note-3', createdAt: '2025-02-12T08:00:00Z' },
];

// ============================================================
// MOCK implementations
// ============================================================

const mockNoteTemplateApi = {
  getAll: async (): Promise<ApiResponse<NoteTemplate[]>> => {
    await delay();
    return { data: [...noteTemplates], message: 'Success', success: true, statusCode: 200 };
  },
  create: async (data: Omit<NoteTemplate, 'id' | 'createdAt'>): Promise<ApiResponse<NoteTemplate>> => {
    await delay();
    const item: NoteTemplate = { ...data, id: genId('ntpl'), createdAt: new Date().toISOString() };
    noteTemplates = [...noteTemplates, item];
    return { data: item, message: 'Template created', success: true, statusCode: 201 };
  },
  update: async (id: string, data: Partial<NoteTemplate>): Promise<ApiResponse<NoteTemplate>> => {
    await delay();
    const idx = noteTemplates.findIndex(t => t.id === id);
    if (idx === -1) return { data: null as unknown as NoteTemplate, message: 'Not found', success: false, statusCode: 404 };
    noteTemplates[idx] = { ...noteTemplates[idx], ...data };
    noteTemplates = [...noteTemplates];
    return { data: noteTemplates[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    noteTemplates = noteTemplates.filter(t => t.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
};

function mockCreateOneNote(data: Omit<Note, 'id' | 'createdAt' | 'status'>): Note {
  const defaults = getApprovalDefaults();
  const note: Note = { ...data, id: genId('note'), status: defaults.noteApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() };
  notes = [...notes, note];
  const tpl = noteTemplates.find(t => t.id === data.templateId);
  if (tpl?.isPointEffect && tpl.pointEffect > 0) {
    const pt: PointRecord = { id: genId('pt'), studentId: data.studentId, type: tpl.type, amount: tpl.pointEffect, date: data.date, sourceNoteId: note.id, createdAt: new Date().toISOString() };
    points = [...points, pt];
  }
  return note;
}

const mockNoteApi = {
  getAll: async (filter?: { studentId?: string; templateId?: string; dateFrom?: string; dateTo?: string }): Promise<ApiResponse<Note[]>> => {
    await delay();
    let items = [...notes];
    if (filter?.studentId) items = items.filter(n => n.studentId === filter.studentId);
    if (filter?.templateId) items = items.filter(n => n.templateId === filter.templateId);
    if (filter?.dateFrom) items = items.filter(n => n.date >= filter.dateFrom!);
    if (filter?.dateTo) items = items.filter(n => n.date <= filter.dateTo!);
    return { data: items, message: 'Success', success: true, statusCode: 200 };
  },
  create: async (data: Omit<Note, 'id' | 'createdAt' | 'status'>): Promise<ApiResponse<Note>> => {
    await delay();
    const note = mockCreateOneNote(data);
    return { data: note, message: 'Note created', success: true, statusCode: 201 };
  },
  createBulk: async (items: Omit<Note, 'id' | 'createdAt' | 'status'>[]): Promise<ApiResponse<Note[]>> => {
    await delay();
    const created = items.map(mockCreateOneNote);
    return { data: created, message: `${created.length} notes created`, success: true, statusCode: 201 };
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    points = points.filter(p => p.sourceNoteId !== id);
    notes = notes.filter(n => n.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  bulkUpdateStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    await delay();
    const before = notes.filter(n => ids.includes(n.id));
    notes = notes.map(n => ids.includes(n.id) ? { ...n, status } : n);
    if (status === 'REJECTED') {
      const newlyRejected = before.filter(n => n.status !== 'REJECTED').map(n => n.id);
      points = points.filter(p => !p.sourceNoteId || !newlyRejected.includes(p.sourceNoteId));
    } else {
      // Restore points for notes that were REJECTED → recreate from template
      const wasRejected = before.filter(n => n.status === 'REJECTED');
      for (const note of wasRejected) {
        if (points.some(p => p.sourceNoteId === note.id)) continue;
        const tpl = noteTemplates.find(t => t.id === note.templateId);
        if (tpl?.isPointEffect && tpl.pointEffect > 0) {
          points = [...points, {
            id: genId('pt'),
            studentId: note.studentId,
            type: tpl.type,
            amount: tpl.pointEffect,
            date: note.date,
            sourceNoteId: note.id,
            createdAt: new Date().toISOString(),
          }];
        }
      }
    }
    return { data: null, message: `${ids.length} records updated`, success: true, statusCode: 200 };
  },
  bulkDelete: async (ids: string[]): Promise<ApiResponse<null>> => {
    await delay();
    points = points.filter(p => !ids.includes(p.sourceNoteId || ''));
    notes = notes.filter(n => !ids.includes(n.id));
    return { data: null, message: `${ids.length} records deleted`, success: true, statusCode: 200 };
  },
};

const mockPointApi = {
  getAll: async (filter?: { studentId?: string; type?: 'positive' | 'negative'; dateFrom?: string; dateTo?: string }): Promise<ApiResponse<PointRecord[]>> => {
    await delay();
    let items = [...points];
    if (filter?.studentId) items = items.filter(p => p.studentId === filter.studentId);
    if (filter?.type) items = items.filter(p => p.type === filter.type);
    if (filter?.dateFrom) items = items.filter(p => p.date >= filter.dateFrom!);
    if (filter?.dateTo) items = items.filter(p => p.date <= filter.dateTo!);
    return { data: items, message: 'Success', success: true, statusCode: 200 };
  },
  getStudentTotal: async (studentId: string): Promise<ApiResponse<{ positive: number; negative: number; net: number }>> => {
    await delay();
    const studentPts = points.filter(p => p.studentId === studentId);
    const positive = studentPts.filter(p => p.type === 'positive').reduce((s, p) => s + p.amount, 0);
    const negative = studentPts.filter(p => p.type === 'negative').reduce((s, p) => s + p.amount, 0);
    return { data: { positive, negative, net: positive - negative }, message: 'Success', success: true, statusCode: 200 };
  },
  create: async (data: { studentId: string; type: 'positive' | 'negative'; amount: number; date: string }): Promise<ApiResponse<PointRecord>> => {
    await delay();
    const pt: PointRecord = { ...data, id: genId('pt'), createdAt: new Date().toISOString() };
    points = [...points, pt];
    return { data: pt, message: 'Point created', success: true, statusCode: 201 };
  },
  createBulk: async (items: { studentId: string; type: 'positive' | 'negative'; amount: number; date: string }[]): Promise<ApiResponse<PointRecord[]>> => {
    await delay();
    const created: PointRecord[] = [];
    for (const data of items) {
      const pt: PointRecord = { ...data, id: genId('pt'), createdAt: new Date().toISOString() };
      points = [...points, pt];
      created.push(pt);
    }
    return { data: created, message: `${created.length} points created`, success: true, statusCode: 201 };
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    points = points.filter(p => p.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
};

// ============================================================
// REAL implementations (talk to backend)
// ============================================================

const realNoteTemplateApi = {
  getAll: async (): Promise<ApiResponse<NoteTemplate[]>> => {
    const res = await apiClient.get('note-templates');
    return unwrapResponse<NoteTemplate[]>(res);
  },
  create: async (data: Omit<NoteTemplate, 'id' | 'createdAt'>): Promise<ApiResponse<NoteTemplate>> => {
    const res = await apiClient.post('note-templates', data);
    return unwrapResponse<NoteTemplate>(res);
  },
  update: async (id: string, data: Partial<NoteTemplate>): Promise<ApiResponse<NoteTemplate>> => {
    const { id: _i, createdAt: _c, ...payload } = data as NoteTemplate;
    const res = await apiClient.patch(`note-templates/${encodeURIComponent(id)}`, payload);
    return unwrapResponse<NoteTemplate>(res);
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`note-templates/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },
};

const realNoteApi = {
  getAll: async (filter?: { studentId?: string; templateId?: string; dateFrom?: string; dateTo?: string }): Promise<ApiResponse<Note[]>> => {
    const qs = buildQuery({
      studentId: filter?.studentId,
      templateId: filter?.templateId,
      dateFrom: filter?.dateFrom,
      dateTo: filter?.dateTo,
    });
    const res = await apiClient.get(`notes${qs}`);
    return unwrapResponse<Note[]>(res);
  },
  create: async (data: Omit<Note, 'id' | 'createdAt' | 'status'>): Promise<ApiResponse<Note>> => {
    const res = await apiClient.post('notes', data);
    return unwrapResponse<Note>(res);
  },
  createBulk: async (items: Omit<Note, 'id' | 'createdAt' | 'status'>[]): Promise<ApiResponse<Note[]>> => {
    const res = await apiClient.post('notes/bulk', { items });
    return unwrapResponse<Note[]>(res);
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`notes/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },
  bulkUpdateStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    const res = await apiClient.patch('notes/bulk-status', { ids, status });
    return unwrapVoid(res);
  },
  bulkDelete: async (ids: string[]): Promise<ApiResponse<null>> => {
    const res = await apiClient.post('notes/bulk-delete', { ids });
    return unwrapVoid(res);
  },
};

const realPointApi = {
  getAll: async (filter?: { studentId?: string; type?: 'positive' | 'negative'; dateFrom?: string; dateTo?: string }): Promise<ApiResponse<PointRecord[]>> => {
    const qs = buildQuery({
      studentId: filter?.studentId,
      type: filter?.type,
      dateFrom: filter?.dateFrom,
      dateTo: filter?.dateTo,
    });
    const res = await apiClient.get(`points${qs}`);
    return unwrapResponse<PointRecord[]>(res);
  },
  getStudentTotal: async (studentId: string): Promise<ApiResponse<{ positive: number; negative: number; net: number }>> => {
    const res = await apiClient.get(`points/student/${encodeURIComponent(studentId)}/total`);
    return unwrapResponse<{ positive: number; negative: number; net: number }>(res);
  },
  create: async (data: { studentId: string; type: 'positive' | 'negative'; amount: number; date: string }): Promise<ApiResponse<PointRecord>> => {
    const res = await apiClient.post('points', data);
    return unwrapResponse<PointRecord>(res);
  },
  createBulk: async (items: { studentId: string; type: 'positive' | 'negative'; amount: number; date: string }[]): Promise<ApiResponse<PointRecord[]>> => {
    const res = await apiClient.post('points/bulk', { items });
    return unwrapResponse<PointRecord[]>(res);
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`points/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },
};

// ============================================================
// Public exports gated by APP_CONFIG.USE_MOCK_API
// ============================================================

export const noteTemplateApi = APP_CONFIG.USE_MOCK_API ? mockNoteTemplateApi : realNoteTemplateApi;
export const noteApi         = APP_CONFIG.USE_MOCK_API ? mockNoteApi         : realNoteApi;
export const pointApi        = APP_CONFIG.USE_MOCK_API ? mockPointApi        : realPointApi;
