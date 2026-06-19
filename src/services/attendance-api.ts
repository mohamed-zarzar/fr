import { APP_CONFIG } from '@/config';
import { apiClient, apiRequest, parseJson } from '@/lib/api-client';
import type { ApiResponse, ApprovalStatus } from '@/types';
import type {
  StudentAbsence, StudentLate,
  TeacherAbsence, TeacherLate,
  ManagerAbsence, ManagerLate,
  AttendanceStats, AttendanceFilter, PaginatedAttendanceResponse,
} from '@/types/attendance';
import { getApprovalDefaults } from './settings-api';

const delay = () => new Promise(r => setTimeout(r, APP_CONFIG.MOCK_DELAY));
let idCounter = 500;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;

// ===================== MOCK DATA =====================
let studentAbsences: StudentAbsence[] = [
  { id: 'sa-1', studentId: 'stu-1', date: '2025-02-10', isJustified: true, reason: 'موعد طبي', status: 'APPROVED', firstName: 'أحمد', lastName: 'بن علي', createdAt: '2025-02-10T08:00:00Z' },
  { id: 'sa-2', studentId: 'stu-2', date: '2025-02-12', isJustified: false, status: 'PENDING', firstName: 'فاطمة', lastName: 'الزهراني', createdAt: '2025-02-12T08:00:00Z' },
  { id: 'sa-3', studentId: 'stu-3', date: '2025-02-15', isJustified: true, reason: 'ظرف عائلي طارئ', status: 'APPROVED', firstName: 'محمد', lastName: 'أمين', createdAt: '2025-02-15T08:00:00Z' },
  { id: 'sa-4', studentId: 'stu-1', date: '2025-02-18', isJustified: false, status: 'PENDING', firstName: 'أحمد', lastName: 'بن علي', createdAt: '2025-02-18T08:00:00Z' },
];

let studentLates: StudentLate[] = [
  { id: 'sl-1', studentId: 'stu-1', date: '2025-02-11', isJustified: false, period: 15, status: 'PENDING', firstName: 'أحمد', lastName: 'بن علي', createdAt: '2025-02-11T08:00:00Z' },
  { id: 'sl-2', studentId: 'stu-4', date: '2025-02-13', isJustified: true, reason: 'تأخر الحافلة', period: 5, status: 'APPROVED', firstName: 'سارة', lastName: 'الإدريسي', createdAt: '2025-02-13T08:00:00Z' },
  { id: 'sl-3', studentId: 'stu-2', date: '2025-02-14', isJustified: false, period: 20, status: 'PENDING', firstName: 'فاطمة', lastName: 'الزهراني', createdAt: '2025-02-14T08:00:00Z' },
];

let teacherAbsences: TeacherAbsence[] = [
  { id: 'ta-1', teacherId: 'tea-1', sessionId: 'sess-01', sessionName: 'الحصة 1 - 08:00', date: '2025-02-10', isJustified: true, reason: 'مؤتمر', status: 'APPROVED', firstName: 'كريم', lastName: 'المنصوري', createdAt: '2025-02-10T08:00:00Z' },
  { id: 'ta-2', teacherId: 'tea-2', sessionId: 'sess-03', sessionName: 'الحصة 3 - 10:00', date: '2025-02-14', isJustified: false, status: 'PENDING', firstName: 'نادية', lastName: 'الشرقاوي', createdAt: '2025-02-14T08:00:00Z' },
];

let teacherLates: TeacherLate[] = [
  { id: 'tl-1', teacherId: 'tea-1', sessionId: 'sess-02', sessionName: 'الحصة 2 - 09:00', date: '2025-02-12', isJustified: false, period: 10, status: 'PENDING', firstName: 'كريم', lastName: 'المنصوري', createdAt: '2025-02-12T08:00:00Z' },
  { id: 'tl-2', teacherId: 'tea-3', sessionId: 'sess-01', sessionName: 'الحصة 1 - 08:00', date: '2025-02-16', isJustified: true, reason: 'ازدحام مروري', period: 5, status: 'APPROVED', firstName: 'يوسف', lastName: 'التازي', createdAt: '2025-02-16T08:00:00Z' },
];

let managerAbsences: ManagerAbsence[] = [
  { id: 'ma-1', managerId: 'mgr-1', date: '2025-02-11', isJustified: true, reason: 'إجازة مرضية', status: 'APPROVED', firstName: 'حسن', lastName: 'العلوي', createdAt: '2025-02-11T08:00:00Z' },
];

let managerLates: ManagerLate[] = [
  { id: 'ml-1', managerId: 'mgr-2', date: '2025-02-13', isJustified: false, period: 10, status: 'PENDING', firstName: 'ليلى', lastName: 'البراك', createdAt: '2025-02-13T08:00:00Z' },
];

function applyDateFilter<T extends { date: string }>(items: T[], filter?: AttendanceFilter): T[] {
  if (!filter) return items;
  let result = items;
  if (filter.dateFrom) result = result.filter(i => i.date >= filter.dateFrom!);
  if (filter.dateTo) result = result.filter(i => i.date <= filter.dateTo!);
  if (filter.isJustified !== undefined) result = result.filter(i => (i as unknown as { isJustified: boolean }).isJustified === filter.isJustified);
  return result;
}

function computeStats(absences: { isJustified: boolean }[], lates: { isJustified: boolean; period: number }[]): AttendanceStats {
  const totalLates = lates.length;
  return {
    totalAbsences: absences.length,
    justifiedAbsences: absences.filter(a => a.isJustified).length,
    unjustifiedAbsences: absences.filter(a => !a.isJustified).length,
    totalLates,
    justifiedLates: lates.filter(l => l.isJustified).length,
    unjustifiedLates: lates.filter(l => !l.isJustified).length,
    averageLatePeriod: totalLates > 0 ? Math.round(lates.reduce((s, l) => s + l.period, 0) / totalLates) : 0,
  };
}

// ===================== MOCK IMPLEMENTATIONS =====================

function paginateMock<T>(items: T[], filter?: AttendanceFilter): PaginatedAttendanceResponse<T> {
  const page = filter?.page ?? 1;
  const limit = filter?.limit ?? 1000;
  const total = items.length;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
  const start = (page - 1) * limit;
  return { data: items.slice(start, start + limit), total, page, totalPages, message: 'Success', success: true, statusCode: 200 };
}

export const mockStudentAttendanceApi = {
  getAbsences: async (filter?: AttendanceFilter): Promise<PaginatedAttendanceResponse<StudentAbsence>> => {
    await delay();
    let items = [...studentAbsences];
    if (filter?.entityId) items = items.filter(i => i.studentId === filter.entityId);
    items = applyDateFilter(items, filter);
    return paginateMock(items, filter);
  },
  getLates: async (filter?: AttendanceFilter): Promise<PaginatedAttendanceResponse<StudentLate>> => {
    await delay();
    let items = [...studentLates];
    if (filter?.entityId) items = items.filter(i => i.studentId === filter.entityId);
    items = applyDateFilter(items, filter);
    return paginateMock(items, filter);
  },
  createAbsence: async (data: Omit<StudentAbsence, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName'>): Promise<ApiResponse<StudentAbsence>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const item: StudentAbsence = { ...data, id: genId('sa'), status: defaults.studentAbsenceApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() };
    studentAbsences.push(item);
    return { data: item, message: 'Absence added', success: true, statusCode: 201 };
  },
  createAbsenceBulk: async (records: Omit<StudentAbsence, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName'>[]): Promise<ApiResponse<StudentAbsence[]>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const items: StudentAbsence[] = [];
    for (const r of records) {
      items.push({ ...r, id: genId('sa'), status: defaults.studentAbsenceApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() });
    }
    studentAbsences.push(...items);
    return { data: items, message: `${items.length} absences added`, success: true, statusCode: 201 };
  },
  updateAbsence: async (id: string, data: Partial<StudentAbsence>): Promise<ApiResponse<StudentAbsence>> => {
    await delay();
    const idx = studentAbsences.findIndex(i => i.id === id);
    if (idx === -1) return { data: null as unknown as StudentAbsence, message: 'Not found', success: false, statusCode: 404 };
    studentAbsences[idx] = { ...studentAbsences[idx], ...data };
    return { data: studentAbsences[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  deleteAbsence: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    studentAbsences = studentAbsences.filter(i => i.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  bulkUpdateAbsenceStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    await delay();
    studentAbsences = studentAbsences.map(i => ids.includes(i.id) ? { ...i, status } : i);
    return { data: null, message: `${ids.length} records updated`, success: true, statusCode: 200 };
  },
  bulkDeleteAbsences: async (ids: string[]): Promise<ApiResponse<null>> => {
    await delay();
    studentAbsences = studentAbsences.filter(i => !ids.includes(i.id));
    return { data: null, message: `${ids.length} records deleted`, success: true, statusCode: 200 };
  },
  createLate: async (data: Omit<StudentLate, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName'>): Promise<ApiResponse<StudentLate>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const item: StudentLate = { ...data, id: genId('sl'), status: defaults.studentLateApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() };
    studentLates.push(item);
    return { data: item, message: 'Late added', success: true, statusCode: 201 };
  },
  createLateBulk: async (records: Omit<StudentLate, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName'>[]): Promise<ApiResponse<StudentLate[]>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const items: StudentLate[] = [];
    for (const r of records) {
      items.push({ ...r, id: genId('sl'), status: defaults.studentLateApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() });
    }
    studentLates.push(...items);
    return { data: items, message: `${items.length} lates added`, success: true, statusCode: 201 };
  },
  updateLate: async (id: string, data: Partial<StudentLate>): Promise<ApiResponse<StudentLate>> => {
    await delay();
    const idx = studentLates.findIndex(i => i.id === id);
    if (idx === -1) return { data: null as unknown as StudentLate, message: 'Not found', success: false, statusCode: 404 };
    studentLates[idx] = { ...studentLates[idx], ...data };
    return { data: studentLates[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  deleteLate: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    studentLates = studentLates.filter(i => i.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  bulkUpdateLateStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    await delay();
    studentLates = studentLates.map(i => ids.includes(i.id) ? { ...i, status } : i);
    return { data: null, message: `${ids.length} records updated`, success: true, statusCode: 200 };
  },
  bulkDeleteLates: async (ids: string[]): Promise<ApiResponse<null>> => {
    await delay();
    studentLates = studentLates.filter(i => !ids.includes(i.id));
    return { data: null, message: `${ids.length} records deleted`, success: true, statusCode: 200 };
  },
  getStats: async (filter?: AttendanceFilter): Promise<ApiResponse<AttendanceStats>> => {
    await delay();
    let abs = [...studentAbsences]; let lts = [...studentLates];
    if (filter?.entityId) { abs = abs.filter(i => i.studentId === filter.entityId); lts = lts.filter(i => i.studentId === filter.entityId); }
    abs = applyDateFilter(abs, filter); lts = applyDateFilter(lts, filter);
    return { data: computeStats(abs, lts), message: 'Success', success: true, statusCode: 200 };
  },
  importExcel: async (_file: File): Promise<ApiResponse<{ imported: number }>> => {
    await delay();
    return { data: { imported: 0 }, message: 'Mock import not supported', success: true, statusCode: 200 };
  },
  exportExcel: async (_filter?: AttendanceFilter): Promise<void> => {
    await delay();
  },
  downloadTemplate: async (): Promise<void> => {
    await delay();
  },
};

export const mockTeacherAttendanceApi = {
  getAbsences: async (filter?: AttendanceFilter): Promise<PaginatedAttendanceResponse<TeacherAbsence>> => {
    await delay();
    let items = [...teacherAbsences];
    if (filter?.entityId) items = items.filter(i => i.teacherId === filter.entityId);
    items = applyDateFilter(items, filter);
    return paginateMock(items, filter);
  },
  getLates: async (filter?: AttendanceFilter): Promise<PaginatedAttendanceResponse<TeacherLate>> => {
    await delay();
    let items = [...teacherLates];
    if (filter?.entityId) items = items.filter(i => i.teacherId === filter.entityId);
    items = applyDateFilter(items, filter);
    return paginateMock(items, filter);
  },
  createAbsence: async (data: Omit<TeacherAbsence, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName' | 'sessionName'>): Promise<ApiResponse<TeacherAbsence>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const item: TeacherAbsence = { ...data, id: genId('ta'), status: defaults.teacherAbsenceApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() };
    teacherAbsences.push(item);
    return { data: item, message: 'Absence added', success: true, statusCode: 201 };
  },
  createAbsenceBulk: async (records: Omit<TeacherAbsence, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName' | 'sessionName'>[]): Promise<ApiResponse<TeacherAbsence[]>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const items: TeacherAbsence[] = [];
    for (const r of records) {
      items.push({ ...r, id: genId('ta'), status: defaults.teacherAbsenceApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() });
    }
    teacherAbsences.push(...items);
    return { data: items, message: `${items.length} absences added`, success: true, statusCode: 201 };
  },
  updateAbsence: async (id: string, data: Partial<TeacherAbsence>): Promise<ApiResponse<TeacherAbsence>> => {
    await delay();
    const idx = teacherAbsences.findIndex(i => i.id === id);
    if (idx === -1) return { data: null as unknown as TeacherAbsence, message: 'Not found', success: false, statusCode: 404 };
    teacherAbsences[idx] = { ...teacherAbsences[idx], ...data };
    return { data: teacherAbsences[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  deleteAbsence: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    teacherAbsences = teacherAbsences.filter(i => i.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  bulkUpdateAbsenceStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    await delay();
    teacherAbsences = teacherAbsences.map(i => ids.includes(i.id) ? { ...i, status } : i);
    return { data: null, message: `${ids.length} records updated`, success: true, statusCode: 200 };
  },
  bulkDeleteAbsences: async (ids: string[]): Promise<ApiResponse<null>> => {
    await delay();
    teacherAbsences = teacherAbsences.filter(i => !ids.includes(i.id));
    return { data: null, message: `${ids.length} records deleted`, success: true, statusCode: 200 };
  },
  createLate: async (data: Omit<TeacherLate, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName' | 'sessionName'>): Promise<ApiResponse<TeacherLate>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const item: TeacherLate = { ...data, id: genId('tl'), status: defaults.teacherLateApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() };
    teacherLates.push(item);
    return { data: item, message: 'Late added', success: true, statusCode: 201 };
  },
  createLateBulk: async (records: Omit<TeacherLate, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName' | 'sessionName'>[]): Promise<ApiResponse<TeacherLate[]>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const items: TeacherLate[] = [];
    for (const r of records) {
      items.push({ ...r, id: genId('tl'), status: defaults.teacherLateApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() });
    }
    teacherLates.push(...items);
    return { data: items, message: `${items.length} lates added`, success: true, statusCode: 201 };
  },
  updateLate: async (id: string, data: Partial<TeacherLate>): Promise<ApiResponse<TeacherLate>> => {
    await delay();
    const idx = teacherLates.findIndex(i => i.id === id);
    if (idx === -1) return { data: null as unknown as TeacherLate, message: 'Not found', success: false, statusCode: 404 };
    teacherLates[idx] = { ...teacherLates[idx], ...data };
    return { data: teacherLates[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  deleteLate: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    teacherLates = teacherLates.filter(i => i.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  bulkUpdateLateStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    await delay();
    teacherLates = teacherLates.map(i => ids.includes(i.id) ? { ...i, status } : i);
    return { data: null, message: `${ids.length} records updated`, success: true, statusCode: 200 };
  },
  bulkDeleteLates: async (ids: string[]): Promise<ApiResponse<null>> => {
    await delay();
    teacherLates = teacherLates.filter(i => !ids.includes(i.id));
    return { data: null, message: `${ids.length} records deleted`, success: true, statusCode: 200 };
  },
  getStats: async (filter?: AttendanceFilter): Promise<ApiResponse<AttendanceStats>> => {
    await delay();
    let abs = [...teacherAbsences]; let lts = [...teacherLates];
    if (filter?.entityId) { abs = abs.filter(i => i.teacherId === filter.entityId); lts = lts.filter(i => i.teacherId === filter.entityId); }
    abs = applyDateFilter(abs, filter); lts = applyDateFilter(lts, filter);
    return { data: computeStats(abs, lts), message: 'Success', success: true, statusCode: 200 };
  },
  importExcel: async (_file: File): Promise<ApiResponse<{ imported: number }>> => {
    await delay();
    return { data: { imported: 0 }, message: 'Mock import not supported', success: true, statusCode: 200 };
  },
  exportExcel: async (_filter?: AttendanceFilter): Promise<void> => {
    await delay();
  },
  downloadTemplate: async (): Promise<void> => {
    await delay();
  },
};

export const mockManagerAttendanceApi = {
  getAbsences: async (filter?: AttendanceFilter): Promise<PaginatedAttendanceResponse<ManagerAbsence>> => {
    await delay();
    let items = [...managerAbsences];
    if (filter?.entityId) items = items.filter(i => i.managerId === filter.entityId);
    items = applyDateFilter(items, filter);
    return paginateMock(items, filter);
  },
  getLates: async (filter?: AttendanceFilter): Promise<PaginatedAttendanceResponse<ManagerLate>> => {
    await delay();
    let items = [...managerLates];
    if (filter?.entityId) items = items.filter(i => i.managerId === filter.entityId);
    items = applyDateFilter(items, filter);
    return paginateMock(items, filter);
  },
  createAbsence: async (data: Omit<ManagerAbsence, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName'>): Promise<ApiResponse<ManagerAbsence>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const item: ManagerAbsence = { ...data, id: genId('ma'), status: defaults.managerAbsenceApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() };
    managerAbsences.push(item);
    return { data: item, message: 'Absence added', success: true, statusCode: 201 };
  },
  createAbsenceBulk: async (records: Omit<ManagerAbsence, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName'>[]): Promise<ApiResponse<ManagerAbsence[]>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const items: ManagerAbsence[] = [];
    for (const r of records) {
      items.push({ ...r, id: genId('ma'), status: defaults.managerAbsenceApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() });
    }
    managerAbsences.push(...items);
    return { data: items, message: `${items.length} absences added`, success: true, statusCode: 201 };
  },
  updateAbsence: async (id: string, data: Partial<ManagerAbsence>): Promise<ApiResponse<ManagerAbsence>> => {
    await delay();
    const idx = managerAbsences.findIndex(i => i.id === id);
    if (idx === -1) return { data: null as unknown as ManagerAbsence, message: 'Not found', success: false, statusCode: 404 };
    managerAbsences[idx] = { ...managerAbsences[idx], ...data };
    return { data: managerAbsences[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  deleteAbsence: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    managerAbsences = managerAbsences.filter(i => i.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  bulkUpdateAbsenceStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    await delay();
    managerAbsences = managerAbsences.map(i => ids.includes(i.id) ? { ...i, status } : i);
    return { data: null, message: `${ids.length} records updated`, success: true, statusCode: 200 };
  },
  bulkDeleteAbsences: async (ids: string[]): Promise<ApiResponse<null>> => {
    await delay();
    managerAbsences = managerAbsences.filter(i => !ids.includes(i.id));
    return { data: null, message: `${ids.length} records deleted`, success: true, statusCode: 200 };
  },
  createLate: async (data: Omit<ManagerLate, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName'>): Promise<ApiResponse<ManagerLate>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const item: ManagerLate = { ...data, id: genId('ml'), status: defaults.managerLateApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() };
    managerLates.push(item);
    return { data: item, message: 'Late added', success: true, statusCode: 201 };
  },
  createLateBulk: async (records: Omit<ManagerLate, 'id' | 'createdAt' | 'status' | 'firstName' | 'lastName'>[]): Promise<ApiResponse<ManagerLate[]>> => {
    await delay();
    const defaults = getApprovalDefaults();
    const items: ManagerLate[] = [];
    for (const r of records) {
      items.push({ ...r, id: genId('ml'), status: defaults.managerLateApproved ? 'APPROVED' : 'PENDING', createdAt: new Date().toISOString() });
    }
    managerLates.push(...items);
    return { data: items, message: `${items.length} lates added`, success: true, statusCode: 201 };
  },
  updateLate: async (id: string, data: Partial<ManagerLate>): Promise<ApiResponse<ManagerLate>> => {
    await delay();
    const idx = managerLates.findIndex(i => i.id === id);
    if (idx === -1) return { data: null as unknown as ManagerLate, message: 'Not found', success: false, statusCode: 404 };
    managerLates[idx] = { ...managerLates[idx], ...data };
    return { data: managerLates[idx], message: 'Updated', success: true, statusCode: 200 };
  },
  deleteLate: async (id: string): Promise<ApiResponse<null>> => {
    await delay();
    managerLates = managerLates.filter(i => i.id !== id);
    return { data: null, message: 'Deleted', success: true, statusCode: 200 };
  },
  bulkUpdateLateStatus: async (ids: string[], status: ApprovalStatus): Promise<ApiResponse<null>> => {
    await delay();
    managerLates = managerLates.map(i => ids.includes(i.id) ? { ...i, status } : i);
    return { data: null, message: `${ids.length} records updated`, success: true, statusCode: 200 };
  },
  bulkDeleteLates: async (ids: string[]): Promise<ApiResponse<null>> => {
    await delay();
    managerLates = managerLates.filter(i => !ids.includes(i.id));
    return { data: null, message: `${ids.length} records deleted`, success: true, statusCode: 200 };
  },
  getStats: async (filter?: AttendanceFilter): Promise<ApiResponse<AttendanceStats>> => {
    await delay();
    let abs = [...managerAbsences]; let lts = [...managerLates];
    if (filter?.entityId) { abs = abs.filter(i => i.managerId === filter.entityId); lts = lts.filter(i => i.managerId === filter.entityId); }
    abs = applyDateFilter(abs, filter); lts = applyDateFilter(lts, filter);
    return { data: computeStats(abs, lts), message: 'Success', success: true, statusCode: 200 };
  },
  importExcel: async (_file: File): Promise<ApiResponse<{ imported: number }>> => {
    await delay();
    return { data: { imported: 0 }, message: 'Mock import not supported', success: true, statusCode: 200 };
  },
  exportExcel: async (_filter?: AttendanceFilter): Promise<void> => {
    await delay();
  },
  downloadTemplate: async (): Promise<void> => {
    await delay();
  },
};

// ===================== REAL API HELPERS =====================

type BackendListRow = {
  id: string;
  actorId: string;
  userId: string;
  code: number;
  firstName: string;
  lastName: string;
  type: string;
  date: string;
  isJustified: boolean;
  reason: string | null;
  period: number | null;
  sessionId: string | null;
  levelId: string | null;
  classId: string | null;
  levelName: string | null;
  className: string | null;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
};

type BackendStatsResult = {
  totalAbsences: number;
  justifiedAbsences: number;
  unjustifiedAbsences: number;
  totalLates: number;
  justifiedLates: number;
  unjustifiedLates: number;
  avgLatePeriod: number;
};

function buildAttendanceQuery(
  filter?: AttendanceFilter,
  extra?: Record<string, string | number | undefined>,
  actorKey = 'actorIds',
): string {
  const q = new URLSearchParams();
  if (filter?.entityId) q.append(actorKey, filter.entityId);
  if (filter?.dateFrom) q.set('dateFrom', filter.dateFrom);
  if (filter?.dateTo) q.set('dateTo', filter.dateTo);
  if (filter?.classId) q.set('classId', filter.classId);
  if (filter?.levelId) q.set('levelId', filter.levelId);
  if (filter?.subjectId) q.set('subjectId', filter.subjectId);
  if (filter?.isJustified !== undefined) q.set('isJustified', String(filter.isJustified));
  if (filter?.page !== undefined) q.set('page', String(filter.page));
  if (filter?.limit !== undefined) q.set('limit', String(filter.limit));
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

function toDateStr(d: string | Date): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function realUnwrapList<T>(res: Response, mapper: (row: BackendListRow) => T): Promise<PaginatedAttendanceResponse<T>> {
  const body = await parseJson<{ data: { items: BackendListRow[]; total: number; page?: number; totalPages?: number } | null; message: string; error: null | unknown; statusCode: number }>(res);
  if (!res.ok || !body) {
    return { data: [], total: 0, page: 1, totalPages: 0, message: body?.message ?? 'Request failed', success: false, statusCode: res.status };
  }
  const items = body.data?.items ?? [];
  const total = body.data?.total ?? items.length;
  const page = body.data?.page ?? 1;
  const totalPages = body.data?.totalPages ?? (total > 0 ? 1 : 0);
  return {
    data: items.map(mapper),
    total,
    page,
    totalPages,
    message: body.message ?? 'Success',
    success: true,
    statusCode: body.statusCode ?? 200,
  };
}

async function realUnwrapSingle<T>(res: Response, mapper: (row: unknown) => T): Promise<ApiResponse<T>> {
  const body = await parseJson<{ data: unknown; message: string; statusCode: number }>(res);
  if (!res.ok || !body) {
    return { data: null as unknown as T, message: body?.message ?? 'Request failed', success: false, statusCode: res.status };
  }
  return { data: mapper(body.data), message: body.message ?? 'Success', success: true, statusCode: body.statusCode ?? 200 };
}

async function realUnwrapVoid(res: Response): Promise<ApiResponse<null>> {
  const body = await parseJson<{ message?: string; statusCode?: number }>(res);
  return {
    data: null,
    message: body?.message ?? (res.ok ? 'Success' : 'Request failed'),
    success: res.ok,
    statusCode: body?.statusCode ?? res.status,
  };
}

async function downloadExcelBlobAttendance(res: Response, fallbackFilename: string): Promise<void> {
  if (!res.ok) {
    const body = await parseJson<{ message?: string }>(res);
    throw new Error(body?.message ?? 'Download failed');
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition');
  let filename = fallbackFilename;
  if (cd) {
    const m = /filename="([^"]+)"/i.exec(cd) ?? /filename=([^;\s]+)/i.exec(cd);
    if (m?.[1]) filename = m[1].replace(/"/g, '');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===================== REAL STUDENT ATTENDANCE API =====================

function mapStudentAbsence(row: BackendListRow): StudentAbsence {
  return {
    id: row.id,
    studentId: row.actorId,
    date: toDateStr(row.date),
    isJustified: row.isJustified,
    reason: row.reason ?? undefined,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
  };
}

function mapStudentLate(row: BackendListRow): StudentLate {
  return {
    id: row.id,
    studentId: row.actorId,
    date: toDateStr(row.date),
    isJustified: row.isJustified,
    reason: row.reason ?? undefined,
    period: row.period ?? 0,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
  };
}

const studentAttendanceQuery = (filter?: AttendanceFilter, extra?: Record<string, string | number | undefined>) =>
  buildAttendanceQuery(filter, extra, 'students');

export const realStudentAttendanceApi = {
  getAbsences: (filter?: AttendanceFilter) =>
    apiClient.get(`student-attendance/absences${studentAttendanceQuery(filter)}`)
      .then(res => realUnwrapList(res, mapStudentAbsence)),
  getLates: (filter?: AttendanceFilter) =>
    apiClient.get(`student-attendance/lates${studentAttendanceQuery(filter)}`)
      .then(res => realUnwrapList(res, mapStudentLate)),
  createAbsence: async (data: { studentId: string; date: string; isJustified: boolean; reason?: string }): Promise<ApiResponse<StudentAbsence>> => {
    const res = await apiClient.post('student-attendance', { studentId: data.studentId, date: data.date, isJustified: data.isJustified, reason: data.reason });
    return realUnwrapSingle(res, (row) => mapStudentAbsence(row as BackendListRow));
  },
  createAbsenceBulk: async (records: { studentId: string; date: string; isJustified: boolean; reason?: string }[]): Promise<ApiResponse<StudentAbsence[]>> => {
    const res = await apiClient.post('student-attendance/bulk-absence', { records });
    return realUnwrapSingle(res, () => []) as unknown as Promise<ApiResponse<StudentAbsence[]>>;
  },
  updateAbsence: async (id: string, data: Partial<StudentAbsence>): Promise<ApiResponse<StudentAbsence>> => {
    const res = await apiClient.patch(`student-attendance/${id}`, { isJustified: data.isJustified, reason: data.reason, period: data.period, status: data.status });
    return realUnwrapSingle(res, (row) => mapStudentAbsence(row as BackendListRow));
  },
  deleteAbsence: async (id: string) => realUnwrapVoid(await apiClient.delete(`student-attendance/${id}`)),
  bulkUpdateAbsenceStatus: async (ids: string[], status: ApprovalStatus) =>
    realUnwrapVoid(await apiClient.patch('student-attendance/bulk-status', { ids, status })),
  bulkDeleteAbsences: async (ids: string[]) =>
    realUnwrapVoid(await apiClient.post('student-attendance/bulk-delete', { ids })),
  createLate: async (data: { studentId: string; date: string; isJustified: boolean; reason?: string; period: number }): Promise<ApiResponse<StudentLate>> => {
    const res = await apiClient.post('student-attendance/late', data);
    return realUnwrapSingle(res, (row) => mapStudentLate(row as BackendListRow));
  },
  createLateBulk: async (records: { studentId: string; date: string; isJustified: boolean; reason?: string; period: number }[]): Promise<ApiResponse<StudentLate[]>> => {
    const res = await apiClient.post('student-attendance/bulk-late', { records });
    return realUnwrapSingle(res, () => []) as unknown as Promise<ApiResponse<StudentLate[]>>;
  },
  updateLate: async (id: string, data: Partial<StudentLate>): Promise<ApiResponse<StudentLate>> => {
    const res = await apiClient.patch(`student-attendance/${id}`, { isJustified: data.isJustified, reason: data.reason, period: data.period, status: data.status });
    return realUnwrapSingle(res, (row) => mapStudentLate(row as BackendListRow));
  },
  deleteLate: async (id: string) => realUnwrapVoid(await apiClient.delete(`student-attendance/${id}`)),
  bulkUpdateLateStatus: async (ids: string[], status: ApprovalStatus) =>
    realUnwrapVoid(await apiClient.patch('student-attendance/bulk-status', { ids, status })),
  bulkDeleteLates: async (ids: string[]) =>
    realUnwrapVoid(await apiClient.post('student-attendance/bulk-delete', { ids })),
  getStats: async (filter?: AttendanceFilter): Promise<ApiResponse<AttendanceStats>> => {
    const res = await apiClient.get(`student-attendance/stats${studentAttendanceQuery(filter)}`);
    return realUnwrapSingle(res, (raw) => {
      const r = raw as BackendStatsResult;
      return { ...r, averageLatePeriod: r.avgLatePeriod ?? 0 };
    });
  },
  importExcel: async (file: File): Promise<ApiResponse<{ imported: number }>> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiRequest('student-attendance/import', { method: 'POST', body: fd });
    return realUnwrapSingle(res, (raw) => raw as { imported: number });
  },
  exportExcel: async (filter?: AttendanceFilter): Promise<void> => {
    const res = await apiClient.get(`student-attendance/export${studentAttendanceQuery(filter)}`);
    await downloadExcelBlobAttendance(res, 'student-attendance-export.xlsx');
  },
  downloadTemplate: async (): Promise<void> => {
    const res = await apiClient.get('student-attendance/template');
    await downloadExcelBlobAttendance(res, 'student-attendance-template.xlsx');
  },
};

// ===================== REAL TEACHER ATTENDANCE API =====================

function mapTeacherAbsence(row: BackendListRow): TeacherAbsence {
  return {
    id: row.id,
    teacherId: row.actorId,
    sessionId: row.sessionId ?? '',
    date: toDateStr(row.date),
    isJustified: row.isJustified,
    reason: row.reason ?? undefined,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
  };
}

function mapTeacherLate(row: BackendListRow): TeacherLate {
  return {
    id: row.id,
    teacherId: row.actorId,
    sessionId: row.sessionId ?? '',
    date: toDateStr(row.date),
    isJustified: row.isJustified,
    reason: row.reason ?? undefined,
    period: row.period ?? 0,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
  };
}

const teacherAttendanceQuery = (filter?: AttendanceFilter, extra?: Record<string, string | number | undefined>) =>
  buildAttendanceQuery(filter, extra, 'teachers');

export const realTeacherAttendanceApi = {
  getAbsences: (filter?: AttendanceFilter) =>
    apiClient.get(`teacher-attendance/absences${teacherAttendanceQuery(filter)}`)
      .then(res => realUnwrapList(res, mapTeacherAbsence)),
  getLates: (filter?: AttendanceFilter) =>
    apiClient.get(`teacher-attendance/lates${teacherAttendanceQuery(filter)}`)
      .then(res => realUnwrapList(res, mapTeacherLate)),
  createAbsence: async (data: { teacherId: string; sessionId: string; date: string; isJustified: boolean; reason?: string }): Promise<ApiResponse<TeacherAbsence>> => {
    const res = await apiClient.post('teacher-attendance', data);
    return realUnwrapSingle(res, (row) => mapTeacherAbsence(row as BackendListRow));
  },
  createAbsenceBulk: async (records: { teacherId: string; sessionId: string; date: string; isJustified: boolean; reason?: string }[]): Promise<ApiResponse<TeacherAbsence[]>> => {
    const res = await apiClient.post('teacher-attendance/bulk-absence', { records });
    return realUnwrapSingle(res, () => []) as unknown as Promise<ApiResponse<TeacherAbsence[]>>;
  },
  updateAbsence: async (id: string, data: Partial<TeacherAbsence>): Promise<ApiResponse<TeacherAbsence>> => {
    const res = await apiClient.patch(`teacher-attendance/${id}`, { isJustified: data.isJustified, reason: data.reason, status: data.status });
    return realUnwrapSingle(res, (row) => mapTeacherAbsence(row as BackendListRow));
  },
  deleteAbsence: async (id: string) => realUnwrapVoid(await apiClient.delete(`teacher-attendance/${id}`)),
  bulkUpdateAbsenceStatus: async (ids: string[], status: ApprovalStatus) =>
    realUnwrapVoid(await apiClient.patch('teacher-attendance/bulk-status', { ids, status })),
  bulkDeleteAbsences: async (ids: string[]) =>
    realUnwrapVoid(await apiClient.post('teacher-attendance/bulk-delete', { ids })),
  createLate: async (data: { teacherId: string; sessionId: string; date: string; isJustified: boolean; reason?: string; period: number }): Promise<ApiResponse<TeacherLate>> => {
    const res = await apiClient.post('teacher-attendance/late', data);
    return realUnwrapSingle(res, (row) => mapTeacherLate(row as BackendListRow));
  },
  createLateBulk: async (records: { teacherId: string; sessionId: string; date: string; isJustified: boolean; reason?: string; period: number }[]): Promise<ApiResponse<TeacherLate[]>> => {
    const res = await apiClient.post('teacher-attendance/bulk-late', { records });
    return realUnwrapSingle(res, () => []) as unknown as Promise<ApiResponse<TeacherLate[]>>;
  },
  updateLate: async (id: string, data: Partial<TeacherLate>): Promise<ApiResponse<TeacherLate>> => {
    const res = await apiClient.patch(`teacher-attendance/${id}`, { isJustified: data.isJustified, reason: data.reason, period: data.period, status: data.status });
    return realUnwrapSingle(res, (row) => mapTeacherLate(row as BackendListRow));
  },
  deleteLate: async (id: string) => realUnwrapVoid(await apiClient.delete(`teacher-attendance/${id}`)),
  bulkUpdateLateStatus: async (ids: string[], status: ApprovalStatus) =>
    realUnwrapVoid(await apiClient.patch('teacher-attendance/bulk-status', { ids, status })),
  bulkDeleteLates: async (ids: string[]) =>
    realUnwrapVoid(await apiClient.post('teacher-attendance/bulk-delete', { ids })),
  getStats: async (filter?: AttendanceFilter): Promise<ApiResponse<AttendanceStats>> => {
    const res = await apiClient.get(`teacher-attendance/stats${teacherAttendanceQuery(filter)}`);
    return realUnwrapSingle(res, (raw) => {
      const r = raw as BackendStatsResult;
      return { ...r, averageLatePeriod: r.avgLatePeriod ?? 0 };
    });
  },
  importExcel: async (file: File): Promise<ApiResponse<{ imported: number }>> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiRequest('teacher-attendance/import', { method: 'POST', body: fd });
    return realUnwrapSingle(res, (raw) => raw as { imported: number });
  },
  exportExcel: async (filter?: AttendanceFilter): Promise<void> => {
    const res = await apiClient.get(`teacher-attendance/export${teacherAttendanceQuery(filter)}`);
    await downloadExcelBlobAttendance(res, 'teacher-attendance-export.xlsx');
  },
  downloadTemplate: async (): Promise<void> => {
    const res = await apiClient.get('teacher-attendance/template');
    await downloadExcelBlobAttendance(res, 'teacher-attendance-template.xlsx');
  },
};

// ===================== REAL MANAGER ATTENDANCE API =====================

function mapManagerAbsence(row: BackendListRow): ManagerAbsence {
  return {
    id: row.id,
    managerId: row.actorId,
    date: toDateStr(row.date),
    isJustified: row.isJustified,
    reason: row.reason ?? undefined,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
  };
}

function mapManagerLate(row: BackendListRow): ManagerLate {
  return {
    id: row.id,
    managerId: row.actorId,
    date: toDateStr(row.date),
    isJustified: row.isJustified,
    reason: row.reason ?? undefined,
    period: row.period ?? 0,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
  };
}

const managerAttendanceQuery = (filter?: AttendanceFilter, extra?: Record<string, string | number | undefined>) =>
  buildAttendanceQuery(filter, extra, 'managers');

export const realManagerAttendanceApi = {
  getAbsences: (filter?: AttendanceFilter) =>
    apiClient.get(`manager-attendance/absences${managerAttendanceQuery(filter)}`)
      .then(res => realUnwrapList(res, mapManagerAbsence)),
  getLates: (filter?: AttendanceFilter) =>
    apiClient.get(`manager-attendance/lates${managerAttendanceQuery(filter)}`)
      .then(res => realUnwrapList(res, mapManagerLate)),
  createAbsence: async (data: { managerId: string; date: string; isJustified: boolean; reason?: string }): Promise<ApiResponse<ManagerAbsence>> => {
    const res = await apiClient.post('manager-attendance', data);
    return realUnwrapSingle(res, (row) => mapManagerAbsence(row as BackendListRow));
  },
  createAbsenceBulk: async (records: { managerId: string; date: string; isJustified: boolean; reason?: string }[]): Promise<ApiResponse<ManagerAbsence[]>> => {
    const res = await apiClient.post('manager-attendance/bulk-absence', { records });
    return realUnwrapSingle(res, () => []) as unknown as Promise<ApiResponse<ManagerAbsence[]>>;
  },
  updateAbsence: async (id: string, data: Partial<ManagerAbsence>): Promise<ApiResponse<ManagerAbsence>> => {
    const res = await apiClient.patch(`manager-attendance/${id}`, { isJustified: data.isJustified, reason: data.reason, status: data.status });
    return realUnwrapSingle(res, (row) => mapManagerAbsence(row as BackendListRow));
  },
  deleteAbsence: async (id: string) => realUnwrapVoid(await apiClient.delete(`manager-attendance/${id}`)),
  bulkUpdateAbsenceStatus: async (ids: string[], status: ApprovalStatus) =>
    realUnwrapVoid(await apiClient.patch('manager-attendance/bulk-status', { ids, status })),
  bulkDeleteAbsences: async (ids: string[]) =>
    realUnwrapVoid(await apiClient.post('manager-attendance/bulk-delete', { ids })),
  createLate: async (data: { managerId: string; date: string; isJustified: boolean; reason?: string; period: number }): Promise<ApiResponse<ManagerLate>> => {
    const res = await apiClient.post('manager-attendance/late', data);
    return realUnwrapSingle(res, (row) => mapManagerLate(row as BackendListRow));
  },
  createLateBulk: async (records: { managerId: string; date: string; isJustified: boolean; reason?: string; period: number }[]): Promise<ApiResponse<ManagerLate[]>> => {
    const res = await apiClient.post('manager-attendance/bulk-late', { records });
    return realUnwrapSingle(res, () => []) as unknown as Promise<ApiResponse<ManagerLate[]>>;
  },
  updateLate: async (id: string, data: Partial<ManagerLate>): Promise<ApiResponse<ManagerLate>> => {
    const res = await apiClient.patch(`manager-attendance/${id}`, { isJustified: data.isJustified, reason: data.reason, period: data.period, status: data.status });
    return realUnwrapSingle(res, (row) => mapManagerLate(row as BackendListRow));
  },
  deleteLate: async (id: string) => realUnwrapVoid(await apiClient.delete(`manager-attendance/${id}`)),
  bulkUpdateLateStatus: async (ids: string[], status: ApprovalStatus) =>
    realUnwrapVoid(await apiClient.patch('manager-attendance/bulk-status', { ids, status })),
  bulkDeleteLates: async (ids: string[]) =>
    realUnwrapVoid(await apiClient.post('manager-attendance/bulk-delete', { ids })),
  getStats: async (filter?: AttendanceFilter): Promise<ApiResponse<AttendanceStats>> => {
    const res = await apiClient.get(`manager-attendance/stats${managerAttendanceQuery(filter)}`);
    return realUnwrapSingle(res, (raw) => {
      const r = raw as BackendStatsResult;
      return { ...r, averageLatePeriod: r.avgLatePeriod ?? 0 };
    });
  },
  importExcel: async (file: File): Promise<ApiResponse<{ imported: number }>> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiRequest('manager-attendance/import', { method: 'POST', body: fd });
    return realUnwrapSingle(res, (raw) => raw as { imported: number });
  },
  exportExcel: async (filter?: AttendanceFilter): Promise<void> => {
    const res = await apiClient.get(`manager-attendance/export${managerAttendanceQuery(filter)}`);
    await downloadExcelBlobAttendance(res, 'manager-attendance-export.xlsx');
  },
  downloadTemplate: async (): Promise<void> => {
    const res = await apiClient.get('manager-attendance/template');
    await downloadExcelBlobAttendance(res, 'manager-attendance-template.xlsx');
  },
};

// ===================== EXPORTS =====================
export const studentAttendanceApi = APP_CONFIG.USE_MOCK_API ? mockStudentAttendanceApi : realStudentAttendanceApi;
export const teacherAttendanceApi = APP_CONFIG.USE_MOCK_API ? mockTeacherAttendanceApi : realTeacherAttendanceApi;
export const managerAttendanceApi = APP_CONFIG.USE_MOCK_API ? mockManagerAttendanceApi : realManagerAttendanceApi;

export { getSessionOptions } from './settings-api';
