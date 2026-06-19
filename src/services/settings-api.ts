import { APP_CONFIG } from '@/config';
import { apiClient, parseJson } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

const delay = () => new Promise(r => setTimeout(r, APP_CONFIG.MOCK_DELAY));

export interface ApprovalDefaults {
  noteApproved: boolean;
  studentAbsenceApproved: boolean;
  studentLateApproved: boolean;
  teacherAbsenceApproved: boolean;
  teacherLateApproved: boolean;
  managerAbsenceApproved: boolean;
  managerLateApproved: boolean;
  markRecordApproved: boolean;
  officialMarkRecordApproved: boolean;
}

export interface SessionDefinition {
  id: string;
  name: string;
}

export interface PredefinedSettings {
  sessions: string[];
  approvalDefaults: ApprovalDefaults;
}

const defaultApprovalDefaults: ApprovalDefaults = {
  noteApproved: false,
  studentAbsenceApproved: false,
  studentLateApproved: false,
  teacherAbsenceApproved: false,
  teacherLateApproved: false,
  managerAbsenceApproved: false,
  managerLateApproved: false,
  markRecordApproved: false,
  officialMarkRecordApproved: false,
};

let predefinedSettings: PredefinedSettings = {
  sessions: [
    'Session 1 - 08:00',
    'Session 2 - 09:00',
    'Session 3 - 10:00',
    'Session 4 - 11:00',
    'Session 5 - 13:00',
    'Session 6 - 14:00',
    'Session 7 - 15:00',
    'Session 8 - 16:00',
  ],
  approvalDefaults: { ...defaultApprovalDefaults },
};

/** Mock session definitions with stable synthetic IDs */
const mockSessionDefinitions: SessionDefinition[] = predefinedSettings.sessions.map((name, i) => ({
  id: `sess-${String(i + 1).padStart(2, '0')}`,
  name,
}));

/**
 * Module-level cache of approval defaults.
 * Kept in sync by both mock and real flows so the sync `getApprovalDefaults()`
 * helper stays correct for callers that don't await a fetch (attendance-api,
 * mark-record-api, note-point-api). Warmed at app boot via prefetch.
 */
let cachedApprovalDefaults: ApprovalDefaults = { ...defaultApprovalDefaults };

const sanitizeApprovalDefaults = (raw: unknown): ApprovalDefaults => {
  const out = { ...defaultApprovalDefaults };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(out) as (keyof ApprovalDefaults)[]) {
    if (typeof obj[key] === 'boolean') out[key] = obj[key] as boolean;
  }
  return out;
};

const mockSettingsApi = {
  getPredefined: async (): Promise<ApiResponse<PredefinedSettings>> => {
    await delay();
    cachedApprovalDefaults = { ...predefinedSettings.approvalDefaults };
    return {
      data: {
        ...predefinedSettings,
        sessions: [...predefinedSettings.sessions],
        approvalDefaults: { ...predefinedSettings.approvalDefaults },
      },
      message: 'Success', success: true, statusCode: 200,
    };
  },
  updatePredefined: async (data: PredefinedSettings): Promise<ApiResponse<PredefinedSettings>> => {
    await delay();
    predefinedSettings = { ...data, approvalDefaults: { ...data.approvalDefaults } };
    cachedApprovalDefaults = { ...predefinedSettings.approvalDefaults };
    return { data: { ...predefinedSettings }, message: 'Settings updated', success: true, statusCode: 200 };
  },
  getSessions: async (): Promise<ApiResponse<SessionDefinition[]>> => {
    await delay();
    return { data: [...mockSessionDefinitions], message: 'Success', success: true, statusCode: 200 };
  },
};

/** Read sessions list from backend as SessionDefinition[]. */
export const fetchSessionDefinitions = async (): Promise<SessionDefinition[]> => {
  if (APP_CONFIG.USE_MOCK_API) {
    return [...mockSessionDefinitions];
  }
  const res = await apiClient.get('/settings/sessions');
  const body = await parseJson<{ data?: unknown }>(res);
  if (!res.ok || !body || !Array.isArray(body.data)) return [];
  const out: SessionDefinition[] = [];
  for (const item of body.data) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { name?: unknown }).name === 'string'
    ) {
      out.push({ id: (item as SessionDefinition).id, name: (item as SessionDefinition).name });
    }
  }
  return out;
};

const fetchApprovalDefaults = async (): Promise<ApprovalDefaults> => {
  const res = await apiClient.get('/settings/approval-defaults');
  const body = await parseJson<{ data?: unknown }>(res);
  if (!res.ok || !body) return { ...defaultApprovalDefaults };
  return sanitizeApprovalDefaults(body.data);
};

const realSettingsApi = {
  getPredefined: async (): Promise<ApiResponse<PredefinedSettings>> => {
    const [sessions, approvalDefaults] = await Promise.all([
      fetchSessionDefinitions(),
      fetchApprovalDefaults(),
    ]);
    cachedApprovalDefaults = { ...approvalDefaults };
    return {
      data: { sessions: sessions.map(s => s.name), approvalDefaults },
      message: 'Success', success: true, statusCode: 200,
    };
  },
  updatePredefined: async (data: PredefinedSettings): Promise<ApiResponse<PredefinedSettings>> => {
    const sessionPayload: SessionDefinition[] = data.sessions.map((name, i) => ({
      id: `sess-${String(i + 1).padStart(2, '0')}`,
      name,
    }));
    const [sessRes, defRes] = await Promise.all([
      apiClient.put('/settings/sessions', { sessions: sessionPayload }),
      apiClient.put('/settings/approval-defaults', data.approvalDefaults),
    ]);
    if (!sessRes.ok || !defRes.ok) {
      return {
        data,
        message: 'Failed to update settings',
        success: false,
        statusCode: !sessRes.ok ? sessRes.status : defRes.status,
      };
    }
    cachedApprovalDefaults = { ...data.approvalDefaults };
    return { data, message: 'Settings updated', success: true, statusCode: 200 };
  },
  getSessions: async (): Promise<ApiResponse<SessionDefinition[]>> => {
    const data = await fetchSessionDefinitions();
    return { data, message: 'Success', success: true, statusCode: 200 };
  },
};

export const settingsApi = APP_CONFIG.USE_MOCK_API ? mockSettingsApi : realSettingsApi;

/** @deprecated Use settingsApi.getSessions() instead. Returns sync mock session labels. */
export const getSessionOptions = (): string[] => predefinedSettings.sessions;

/**
 * Sync getter for approval defaults used by create flows in attendance-api,
 * mark-record-api, and note-point-api. Backed by a module-level cache that's
 * updated whenever settingsApi.getPredefined()/updatePredefined() resolves.
 * Warm the cache at app boot by prefetching ['predefined-settings'].
 */
export const getApprovalDefaults = (): ApprovalDefaults => ({ ...cachedApprovalDefaults });
