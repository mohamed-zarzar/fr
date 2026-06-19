import { APP_CONFIG } from '@/config';
import { apiClient, parseJson } from '@/lib/api-client';
import type { ApiResponse, PaginatedResponse, ApprovalStatus } from '@/types';
import type { MarkRecord, MarkRecordSettings, MarkRecordType, OfficialTemplate, OfficialTemplateColumn, NonOfficialMarkRecord, OfficialMarkRecord } from '@/types/mark-record';
import { getApprovalDefaults } from './settings-api';
import { unwrapResponse, unwrapPaginated, unwrapVoid, buildQuery } from './api';

const delay = () => new Promise(r => setTimeout(r, APP_CONFIG.MOCK_DELAY));
let idCounter = 500;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;

let markRecordSettings: MarkRecordSettings = {
  types: [
    { id: 'mrt-1', name: 'Recitation' },
    { id: 'mrt-2', name: 'Testing' },
    { id: 'mrt-3', name: 'Memorization' },
    { id: 'mrt-4', name: 'Homework' },
  ],
  officialTemplates: [
    {
      id: 'otpl-1',
      name: 'Standard Report Card',
      levelId: 'lvl-1',
      columns: [
        { id: 'col-1', name: 'Written Exam', maxScore: 40, order: 1 },
        { id: 'col-2', name: 'Oral Exam', maxScore: 20, order: 2 },
        { id: 'col-3', name: 'Participation', maxScore: 10, order: 3 },
        { id: 'col-4', name: 'Final Exam', maxScore: 30, order: 4 },
      ],
    },
  ],
};

/**
 * Cache shared between mock and real flows so the sync helper getters
 * (getTypes/getTemplates/getTemplateForLevel) stay correct.
 */
let cachedSettings: MarkRecordSettings = JSON.parse(JSON.stringify(markRecordSettings));

let markRecords: MarkRecord[] = [
  { id: 'mr-1', studentId: 'stu-1', subjectId: 'sub-1', levelId: 'lvl-1', classId: 'cls-1', typeId: 'mrt-1', score: 85, maxScore: 100, date: '2024-03-15', notes: 'Good recitation', isOfficial: false, status: 'APPROVED', createdAt: '2024-03-15T10:00:00Z' },
  { id: 'mr-2', studentId: 'stu-2', subjectId: 'sub-2', levelId: 'lvl-1', classId: 'cls-2', typeId: 'mrt-2', score: 90, maxScore: 100, date: '2024-03-16', notes: '', isOfficial: false, status: 'PENDING', createdAt: '2024-03-16T10:00:00Z' },
  { id: 'mr-3', studentId: 'stu-1', subjectId: 'sub-1', levelId: 'lvl-1', classId: 'cls-1', templateId: 'otpl-1', scores: { 'col-1': 35, 'col-2': 18, 'col-3': 9, 'col-4': 25 }, date: '2024-04-01', notes: 'Semester 1', isOfficial: true, status: 'APPROVED', createdAt: '2024-04-01T10:00:00Z' },
  { id: 'mr-4', studentId: 'stu-3', subjectId: 'sub-3', levelId: 'lvl-2', classId: 'cls-3', typeId: 'mrt-3', score: 75, maxScore: 100, date: '2024-03-20', notes: 'Needs improvement', isOfficial: false, status: 'PENDING', createdAt: '2024-03-20T10:00:00Z' },
];

interface MarkRecordFilters {
  page: number;
  limit: number;
  search?: string;
  isOfficial?: boolean | null;
  typeId?: string;
  levelId?: string;
  classId?: string;
  subjectId?: string;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const sanitizeSettings = (raw: unknown): MarkRecordSettings => {
  const out: MarkRecordSettings = { types: [], officialTemplates: [] };
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as { types?: unknown; officialTemplates?: unknown };
  if (Array.isArray(obj.types)) {
    for (const t of obj.types) {
      if (
        t &&
        typeof t === 'object' &&
        typeof (t as MarkRecordType).id === 'string' &&
        typeof (t as MarkRecordType).name === 'string'
      ) {
        out.types.push({ id: (t as MarkRecordType).id, name: (t as MarkRecordType).name });
      }
    }
  }
  if (Array.isArray(obj.officialTemplates)) {
    for (const tpl of obj.officialTemplates) {
      const tt = tpl as OfficialTemplate;
      if (
        tt &&
        typeof tt === 'object' &&
        typeof tt.id === 'string' &&
        typeof tt.name === 'string' &&
        typeof tt.levelId === 'string' &&
        Array.isArray(tt.columns)
      ) {
        out.officialTemplates.push({
          id: tt.id,
          name: tt.name,
          levelId: tt.levelId,
          columns: tt.columns
            .filter(c =>
              c &&
              typeof c === 'object' &&
              typeof c.id === 'string' &&
              typeof c.name === 'string' &&
              typeof c.maxScore === 'number' &&
              typeof c.order === 'number',
            )
            .map(c => {
              const col: OfficialTemplateColumn = { id: c.id, name: c.name, maxScore: c.maxScore, order: c.order };
              if (c.kind === 'input' || c.kind === 'computed') col.kind = c.kind;
              if (col.kind === 'computed' && c.formula && typeof c.formula === 'object') col.formula = c.formula;
              return col;
            }),
        });
      }
    }
  }
  return out;
};

const computeOfficialStats = async (filters: { levelId?: string; classId?: string; subjectId?: string; teacherClassSubjects?: { classId: string; subjectIds: string[] }[]; expectedPairCount?: number }): Promise<ApiResponse<{ completion: { filled: number; total: number; percentage: number }; columnCompletion: { columnId: string; columnName: string; filled: number; total: number; percentage: number }[]; averages: { columnId: string; columnName: string; average: number; maxScore: number }[] }>> => {
  await delay();
  const officialRecords = markRecords.filter(r => r.isOfficial) as OfficialMarkRecord[];
  let filtered = [...officialRecords];
  if (filters.levelId) filtered = filtered.filter(r => r.levelId === filters.levelId);
  if (filters.classId) filtered = filtered.filter(r => r.classId === filters.classId);
  if (filters.subjectId) filtered = filtered.filter(r => r.subjectId === filters.subjectId);
  if (filters.teacherClassSubjects) {
    filtered = filtered.filter(r => filters.teacherClassSubjects!.some(cs => cs.classId === r.classId && cs.subjectIds.includes(r.subjectId)));
  }

  const templateForLevel = filters.levelId ? cachedSettings.officialTemplates.find(t => t.levelId === filters.levelId) : cachedSettings.officialTemplates[0];
  const templateColumns = templateForLevel?.columns || [];
  const expectedPairs = filters.expectedPairCount || filtered.length;
  const totalCells = expectedPairs * templateColumns.length;
  let filledCells = 0;
  const columnAggregates: Record<string, { sum: number; count: number; filled: number; name: string; maxScore: number }> = {};

  for (const col of templateColumns) {
    columnAggregates[col.id] = { sum: 0, count: 0, filled: 0, name: col.name, maxScore: col.maxScore };
  }

  for (const rec of filtered) {
    const tpl = cachedSettings.officialTemplates.find(t => t.id === rec.templateId);
    if (!tpl) continue;
    for (const col of tpl.columns) {
      if (rec.scores[col.id] !== undefined && rec.scores[col.id] !== null) {
        filledCells++;
        if (columnAggregates[col.id]) {
          columnAggregates[col.id].filled++;
          columnAggregates[col.id].sum += rec.scores[col.id];
          columnAggregates[col.id].count++;
        }
      }
    }
  }

  const columnCompletion = templateColumns.map(col => ({
    columnId: col.id,
    columnName: columnAggregates[col.id]?.name || col.name,
    filled: columnAggregates[col.id]?.filled || 0,
    total: expectedPairs,
    percentage: expectedPairs > 0 ? Math.round(((columnAggregates[col.id]?.filled || 0) / expectedPairs) * 100) : 0,
  }));

  const averages = Object.entries(columnAggregates).filter(([, agg]) => agg.count > 0).map(([columnId, agg]) => ({
    columnId,
    columnName: agg.name,
    average: Math.round((agg.sum / agg.count) * 100) / 100,
    maxScore: agg.maxScore,
  }));

  return {
    data: {
      completion: { filled: filledCells, total: totalCells, percentage: totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0 },
      columnCompletion,
      averages,
    },
    message: 'Success', success: true, statusCode: 200,
  };
};

const mockMarkRecordApi = {
  getAll: async (params: MarkRecordFilters): Promise<PaginatedResponse<MarkRecord>> => {
    await delay();
    let items = [...markRecords];
    if (params.isOfficial !== null && params.isOfficial !== undefined) items = items.filter(r => r.isOfficial === params.isOfficial);
    if (params.typeId) items = items.filter(r => !r.isOfficial && (r as NonOfficialMarkRecord).typeId === params.typeId);
    if (params.levelId) items = items.filter(r => r.levelId === params.levelId);
    if (params.classId) items = items.filter(r => r.classId === params.classId);
    if (params.subjectId) items = items.filter(r => r.subjectId === params.subjectId);
    if (params.studentId) items = items.filter(r => r.studentId === params.studentId);
    if (params.search) { const q = params.search.toLowerCase(); items = items.filter(r => r.notes.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)); }
    if (params.dateFrom) items = items.filter(r => r.date >= params.dateFrom!);
    if (params.dateTo) items = items.filter(r => r.date <= params.dateTo!);
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return { data, total, page: params.page, limit: params.limit, totalPages, message: 'Success', success: true, statusCode: 200 };
  },

  getById: async (id: string): Promise<ApiResponse<MarkRecord | null>> => {
    await delay();
    const item = markRecords.find(r => r.id === id) || null;
    return { data: item, message: item ? 'Success' : 'Not found', success: !!item, statusCode: item ? 200 : 404 };
  },

  findOfficialRecord: async (studentId: string, subjectId: string): Promise<ApiResponse<OfficialMarkRecord | null>> => {
    await delay();
    const item = markRecords.find(r => r.isOfficial && r.studentId === studentId && r.subjectId === subjectId) as OfficialMarkRecord | undefined;
    return { data: item || null, message: 'Success', success: true, statusCode: 200 };
  },

  upsertOfficial: async (data: Omit<OfficialMarkRecord, 'id' | 'createdAt' | 'status'>): Promise<ApiResponse<OfficialMarkRecord>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const existing = markRecords.find(r => r.isOfficial && r.studentId === data.studentId && r.subjectId === data.subjectId);
    if (existing) {
      const updated = { ...existing, ...data } as OfficialMarkRecord;
      markRecords = markRecords.map(r => r.id === existing.id ? updated : r);
      return { data: updated, message: 'Updated', success: true, statusCode: 200 };
    } else {
      const newItem = { ...data, id: genId('mr'), status: (defaults.officialMarkRecordApproved ? 'APPROVED' : 'PENDING') as ApprovalStatus, createdAt: new Date().toISOString() } as OfficialMarkRecord;
      markRecords = [...markRecords, newItem];
      return { data: newItem, message: 'Created', success: true, statusCode: 201 };
    }
  },

  create: async (data: Omit<MarkRecord, 'id' | 'createdAt' | 'status'>): Promise<ApiResponse<MarkRecord>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const status: ApprovalStatus = data.isOfficial
      ? (defaults.officialMarkRecordApproved ? 'APPROVED' : 'PENDING')
      : (defaults.markRecordApproved ? 'APPROVED' : 'PENDING');
    const newItem = { ...data, id: genId('mr'), status, createdAt: new Date().toISOString() } as MarkRecord;
    markRecords = [...markRecords, newItem];
    return { data: newItem, message: 'Created', success: true, statusCode: 201 };
  },

  bulkCreate: async (items: Omit<MarkRecord, 'id' | 'createdAt' | 'status'>[]): Promise<ApiResponse<MarkRecord[]>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const created = items.map(d => {
      const status: ApprovalStatus = d.isOfficial
        ? (defaults.officialMarkRecordApproved ? 'APPROVED' : 'PENDING')
        : (defaults.markRecordApproved ? 'APPROVED' : 'PENDING');
      return { ...d, id: genId('mr'), status, createdAt: new Date().toISOString() } as MarkRecord;
    });
    markRecords = [...markRecords, ...created];
    return { data: created, message: `${created.length} records created`, success: true, statusCode: 201 };
  },

  update: async (id: string, data: Partial<MarkRecord>): Promise<ApiResponse<MarkRecord>> => {
    await delay();
    const idx = markRecords.findIndex(r => r.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    markRecords[idx] = { ...markRecords[idx], ...data } as MarkRecord;
    markRecords = [...markRecords];
    return { data: markRecords[idx], message: 'Updated', success: true, statusCode: 200 };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    markRecords = markRecords.filter(r => r.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },

  bulkUpdateStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    await delay();
    markRecords = markRecords.map(r => ids.includes(r.id) ? { ...r, status } as MarkRecord : r);
    return { data: null, message: `${ids.length} records updated`, success: true, statusCode: 200 };
  },

  bulkDelete: async (ids: string[]): Promise<ApiResponse<null>> => {
    await delay();
    markRecords = markRecords.filter(r => !ids.includes(r.id));
    return { data: null, message: `${ids.length} records deleted`, success: true, statusCode: 200 };
  },

  // Settings
  getSettings: async (): Promise<ApiResponse<MarkRecordSettings>> => {
    await delay();
    cachedSettings = JSON.parse(JSON.stringify(markRecordSettings));
    return { data: JSON.parse(JSON.stringify(markRecordSettings)), message: 'Success', success: true, statusCode: 200 };
  },

  updateSettings: async (settings: MarkRecordSettings): Promise<ApiResponse<MarkRecordSettings>> => {
    await delay();
    markRecordSettings = JSON.parse(JSON.stringify(settings));
    cachedSettings = JSON.parse(JSON.stringify(markRecordSettings));
    return { data: markRecordSettings, message: 'Settings updated', success: true, statusCode: 200 };
  },

  getTypes: (): MarkRecordType[] => cachedSettings.types,
  getTemplates: (): OfficialTemplate[] => cachedSettings.officialTemplates,
  getTemplateForLevel: (levelId: string): OfficialTemplate | undefined => cachedSettings.officialTemplates.find(t => t.levelId === levelId),

  getOfficialStats: computeOfficialStats,

  getMainSubjectTotals: async (_params: { subjectId: string; classId?: string; levelId?: string }): Promise<ApiResponse<{ studentId: string; total: number; perChild: { subjectId: string; total: number }[] }[]>> => {
    await delay();
    return { data: [], message: 'Success', success: true, statusCode: 200 };
  },
};

const realMarkRecordApi = {
  getAll: async (params: MarkRecordFilters): Promise<PaginatedResponse<MarkRecord>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      isOfficial: params.isOfficial !== undefined ? String(params.isOfficial) : undefined,
      typeId: params.typeId,
      levelId: params.levelId,
      classId: params.classId,
      subjectId: params.subjectId,
      studentId: params.studentId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
    const res = await apiClient.get(`/mark-records${qs}`);
    return unwrapPaginated<MarkRecord>(res, (raw: any) => ({
      ...raw,
      isOfficial: raw.isOfficial ?? false,
      scores: raw.scores ?? undefined,
    }));
  },

  getById: async (id: string): Promise<ApiResponse<MarkRecord | null>> => {
    const res = await apiClient.get(`/mark-records/${encodeURIComponent(id)}`);
    return unwrapResponse<MarkRecord | null>(res);
  },

  findOfficialRecord: async (studentId: string, subjectId: string): Promise<ApiResponse<OfficialMarkRecord | null>> => {
    const qs = buildQuery({ studentId, subjectId });
    const res = await apiClient.get(`/mark-records/official${qs}`);
    return unwrapResponse<OfficialMarkRecord | null>(res);
  },

  upsertOfficial: async (data: Omit<OfficialMarkRecord, 'id' | 'createdAt' | 'status'>): Promise<ApiResponse<OfficialMarkRecord>> => {
    const res = await apiClient.post('/mark-records/official', data);
    return unwrapResponse<OfficialMarkRecord>(res);
  },

  create: async (data: Omit<MarkRecord, 'id' | 'createdAt' | 'status'>): Promise<ApiResponse<MarkRecord>> => {
    const res = await apiClient.post('/mark-records', data);
    return unwrapResponse<MarkRecord>(res);
  },

  bulkCreate: async (items: Omit<MarkRecord, 'id' | 'createdAt' | 'status'>[]): Promise<ApiResponse<MarkRecord[]>> => {
    const res = await apiClient.post('/mark-records/bulk', { items });
    return unwrapResponse<MarkRecord[]>(res);
  },

  update: async (id: string, data: Partial<MarkRecord>): Promise<ApiResponse<MarkRecord>> => {
    const res = await apiClient.patch(`/mark-records/${encodeURIComponent(id)}`, data);
    return unwrapResponse<MarkRecord>(res);
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`/mark-records/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  bulkUpdateStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    const res = await apiClient.patch('/mark-records/bulk-status', { ids, status });
    return unwrapVoid(res);
  },

  bulkDelete: async (ids: string[]): Promise<ApiResponse<null>> => {
    const res = await apiClient.post('/mark-records/bulk-delete', { ids });
    return unwrapVoid(res);
  },

  getSettings: async (): Promise<ApiResponse<MarkRecordSettings>> => {
    const res = await apiClient.get('/settings/mark-record-settings');
    const body = await parseJson<{ data?: unknown; message?: string }>(res);
    if (!res.ok || !body) {
      return { data: cachedSettings, message: 'Failed to load mark-record settings', success: false, statusCode: res.status };
    }
    cachedSettings = sanitizeSettings(body.data);
    return { data: JSON.parse(JSON.stringify(cachedSettings)), message: body.message || 'Success', success: true, statusCode: 200 };
  },

  updateSettings: async (settings: MarkRecordSettings): Promise<ApiResponse<MarkRecordSettings>> => {
    const res = await apiClient.put('/settings/mark-record-settings', settings);
    const body = await parseJson<{ data?: unknown; message?: string }>(res);
    if (!res.ok) {
      return { data: settings, message: body?.message || 'Failed to update', success: false, statusCode: res.status };
    }
    cachedSettings = sanitizeSettings(body?.data ?? settings);
    return { data: JSON.parse(JSON.stringify(cachedSettings)), message: body?.message || 'Settings updated', success: true, statusCode: 200 };
  },

  getOfficialStats: async (filters: {
    levelId?: string;
    classId?: string;
    subjectId?: string;
    teacherClassSubjects?: { classId: string; subjectIds: string[] }[];
    expectedPairCount?: number;
  }): Promise<ApiResponse<{
    completion: { filled: number; total: number; percentage: number };
    columnCompletion: { columnId: string; columnName: string; filled: number; total: number; percentage: number }[];
    averages: { columnId: string; columnName: string; average: number; maxScore: number }[];
  }>> => {
    const qs = buildQuery({
      levelId: filters.levelId,
      classId: filters.classId,
      subjectId: filters.subjectId,
      expectedPairCount: filters.expectedPairCount,
    });
    const res = await apiClient.get(`/mark-records/official-stats${qs}`);
    return unwrapResponse(res);
  },

  getTypes: (): MarkRecordType[] => cachedSettings.types,
  getTemplates: (): OfficialTemplate[] => cachedSettings.officialTemplates,
  getTemplateForLevel: (levelId: string): OfficialTemplate | undefined => cachedSettings.officialTemplates.find(t => t.levelId === levelId),

  getMainSubjectTotals: async (params: { subjectId: string; classId?: string; levelId?: string }): Promise<ApiResponse<{ studentId: string; total: number; perChild: { subjectId: string; total: number }[] }[]>> => {
    const qs = buildQuery({ subjectId: params.subjectId, classId: params.classId, levelId: params.levelId });
    const res = await apiClient.get(`/mark-records/main-subject-totals${qs}`);
    return unwrapResponse(res);
  },
};

export const markRecordApi = APP_CONFIG.USE_MOCK_API ? mockMarkRecordApi : realMarkRecordApi;
