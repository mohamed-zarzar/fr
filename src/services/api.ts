import { APP_CONFIG } from '@/config';
import { apiClient, apiRequest, parseJson, type ApiWrappedSuccess } from '@/lib/api-client';
import type {
  ApiResponse,
  ClassAssignment,
  PaginatedResponse,
  PaginationParams,
  Student,
  Teacher,
  Parent,
  Manager,
  SchoolClass,
  Level,
  Subject,
  TemplateConfig,
  EntityType,
  EntityTemplateConfig,
} from '@/types';
import { defaultTemplates, initialStudents, initialTeachers, initialParents, initialManagers, initialClasses, initialLevels, initialSubjects } from './mock-data';

// --- HTTP helpers (real API) -------------------------------------------------

export type BackendListPayload<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

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

export async function unwrapResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const body = await parseJson(response);
  const wrapped = isWrappedSuccess<T>(body) ? body : null;
  const statusCode = wrapped?.statusCode ?? response.status;
  const message =
    wrapped && typeof wrapped.message === 'string'
      ? wrapped.message
      : response.ok
        ? 'Success'
        : 'Request failed';
  const success = response.ok && statusCode < 400 && wrapped?.error === null;
  if (!wrapped) {
    return { data: null as T, message, success: false, statusCode };
  }
  return {
    data: wrapped.data as T,
    message,
    success,
    statusCode,
  };
}

export async function unwrapPaginated<R>(
  response: Response,
  mapItem: (raw: unknown) => R,
): Promise<PaginatedResponse<R>> {
  const body = await parseJson(response);
  const wrapped = isWrappedSuccess<BackendListPayload<unknown>>(body) ? body : null;
  const statusCode = wrapped?.statusCode ?? response.status;
  const message =
    wrapped && typeof wrapped.message === 'string'
      ? wrapped.message
      : response.ok
        ? 'Success'
        : 'Request failed';
  const success = response.ok && statusCode < 400 && wrapped?.error === null;

  if (!wrapped || wrapped.data === null || typeof wrapped.data !== 'object') {
    return {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      message,
      success: false,
      statusCode,
    };
  }

  const { items, total, page, limit } = wrapped.data as BackendListPayload<unknown>;
  const list = Array.isArray(items) ? items : [];
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    data: list.map(mapItem),
    total,
    page,
    limit,
    totalPages,
    message,
    success,
    statusCode,
  };
}

export async function unwrapVoid(response: Response): Promise<ApiResponse<null>> {
  const body = await parseJson(response);
  const wrapped = body as ApiWrappedSuccess<null> | { statusCode?: number; message?: string } | null;
  const statusCode =
    wrapped && typeof wrapped === 'object' && 'statusCode' in wrapped
      ? (wrapped as { statusCode: number }).statusCode
      : response.status;
  const message =
    wrapped && typeof wrapped === 'object' && typeof (wrapped as { message?: string }).message === 'string'
      ? (wrapped as { message: string }).message
      : response.ok
        ? 'Success'
        : 'Request failed';
  const success = response.ok && statusCode < 400;
  return { data: null, message, success, statusCode };
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

// --- Student Excel import/export (real API) ----------------------------------

export type StudentImportRowIssue = { row: number; errors: string[] };

export class StudentImportValidationError extends Error {
  readonly rowIssues: StudentImportRowIssue[];
  constructor(message: string, rowIssues: StudentImportRowIssue[]) {
    super(message);
    this.name = 'StudentImportValidationError';
    this.rowIssues = rowIssues;
  }
}

function isStudentImportRowIssueArray(v: unknown): v is StudentImportRowIssue[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (x) =>
      x !== null &&
      typeof x === 'object' &&
      typeof (x as StudentImportRowIssue).row === 'number' &&
      Array.isArray((x as StudentImportRowIssue).errors) &&
      (x as StudentImportRowIssue).errors.every((e) => typeof e === 'string'),
  );
}

function firstMessageString(message: unknown): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.length > 0 && typeof message[0] === 'string') return message[0];
  return 'Request failed';
}

async function downloadExcelBlob(res: Response, fallbackFilename: string): Promise<void> {
  if (!res.ok) {
    const body = await parseJson(res);
    const msg =
      body && typeof body === 'object' && 'message' in body
        ? firstMessageString((body as { message: unknown }).message)
        : 'Download failed';
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition');
  let filename = fallbackFilename;
  if (cd) {
    const utf8 = /filename\*=UTF-8''([^;\s]+)/i.exec(cd);
    if (utf8?.[1]) {
      try {
        filename = decodeURIComponent(utf8[1]);
      } catch {
        filename = utf8[1];
      }
    } else {
      const m = /filename="([^"]+)"/i.exec(cd) ?? /filename=([^;\s]+)/i.exec(cd);
      if (m?.[1]) filename = m[1].replace(/"/g, '');
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function studentsImportExcel(file: File): Promise<{ imported: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiRequest('students/import', {
    method: 'POST',
    body: fd,
  });
  const body = await parseJson<Record<string, unknown>>(res);

  if (res.ok && isWrappedSuccess<{ imported: number }>(body) && body.error === null && body.data && typeof body.data === 'object') {
    const imported = (body.data as { imported?: number }).imported;
    if (typeof imported === 'number') return { imported };
  }

  const errPayload = body && typeof body === 'object' ? body : null;
  const errField = errPayload && 'error' in errPayload ? errPayload.error : undefined;
  if (isStudentImportRowIssueArray(errField)) {
    throw new StudentImportValidationError(
      errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed',
      errField,
    );
  }

  const msg =
    errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed';
  throw new Error(msg);
}

export type StudentExportQuery = {
  levelId?: string;
  classId?: string;
  search?: string;
};

async function studentsExportExcel(params: StudentExportQuery): Promise<void> {
  const qs = buildQuery({
    levelId: params.levelId,
    classId: params.classId,
    search: params.search,
  });
  const res = await apiClient.get(`students/export${qs}`);
  await downloadExcelBlob(res, 'students-export.xlsx');
}

async function studentsDownloadTemplate(): Promise<void> {
  const res = await apiClient.get('students/template');
  await downloadExcelBlob(res, 'students-import-template.xlsx');
}

// --- Teacher Excel import/export (real API) ----------------------------------

export type TeacherImportRowIssue = { row: number; errors: string[] };

export class TeacherImportValidationError extends Error {
  readonly rowIssues: TeacherImportRowIssue[];
  constructor(message: string, rowIssues: TeacherImportRowIssue[]) {
    super(message);
    this.name = 'TeacherImportValidationError';
    this.rowIssues = rowIssues;
  }
}

function isTeacherImportRowIssueArray(v: unknown): v is TeacherImportRowIssue[] {
  return isStudentImportRowIssueArray(v);
}

async function teachersImportExcel(file: File): Promise<{ imported: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiRequest('teachers/import', {
    method: 'POST',
    body: fd,
  });
  const body = await parseJson<Record<string, unknown>>(res);

  if (res.ok && isWrappedSuccess<{ imported: number }>(body) && body.error === null && body.data && typeof body.data === 'object') {
    const imported = (body.data as { imported?: number }).imported;
    if (typeof imported === 'number') return { imported };
  }

  const errPayload = body && typeof body === 'object' ? body : null;
  const errField = errPayload && 'error' in errPayload ? errPayload.error : undefined;
  if (isTeacherImportRowIssueArray(errField)) {
    throw new TeacherImportValidationError(
      errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed',
      errField,
    );
  }

  const msg =
    errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed';
  throw new Error(msg);
}

export type TeacherExportQuery = {
  levelId?: string;
  classId?: string;
  subjectId?: string;
  search?: string;
};

async function teachersExportExcel(params: TeacherExportQuery): Promise<void> {
  const qs = buildQuery({
    levelId: params.levelId,
    classId: params.classId,
    subjectId: params.subjectId,
    search: params.search,
  });
  const res = await apiClient.get(`teachers/export${qs}`);
  await downloadExcelBlob(res, 'teachers-export.xlsx');
}

async function teachersDownloadTemplate(): Promise<void> {
  const res = await apiClient.get('teachers/template');
  await downloadExcelBlob(res, 'teachers-import-template.xlsx');
}

// --- Manager Excel import/export (real API) ----------------------------------

export type ManagerImportRowIssue = { row: number; errors: string[] };

export class ManagerImportValidationError extends Error {
  readonly rowIssues: ManagerImportRowIssue[];
  constructor(message: string, rowIssues: ManagerImportRowIssue[]) {
    super(message);
    this.name = 'ManagerImportValidationError';
    this.rowIssues = rowIssues;
  }
}

function isManagerImportRowIssueArray(v: unknown): v is ManagerImportRowIssue[] {
  return isStudentImportRowIssueArray(v);
}

async function managersImportExcel(file: File): Promise<{ imported: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiRequest('managers/import', {
    method: 'POST',
    body: fd,
  });
  const body = await parseJson<Record<string, unknown>>(res);

  if (res.ok && isWrappedSuccess<{ imported: number }>(body) && body.error === null && body.data && typeof body.data === 'object') {
    const imported = (body.data as { imported?: number }).imported;
    if (typeof imported === 'number') return { imported };
  }

  const errPayload = body && typeof body === 'object' ? body : null;
  const errField = errPayload && 'error' in errPayload ? errPayload.error : undefined;
  if (isManagerImportRowIssueArray(errField)) {
    throw new ManagerImportValidationError(
      errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed',
      errField,
    );
  }

  const msg =
    errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed';
  throw new Error(msg);
}

export type ManagerExportQuery = {
  classId?: string;
  levelId?: string;
  search?: string;
};

async function managersExportExcel(params: ManagerExportQuery): Promise<void> {
  const qs = buildQuery({
    classId: params.classId,
    levelId: params.levelId,
    search: params.search,
  });
  const res = await apiClient.get(`managers/export${qs}`);
  await downloadExcelBlob(res, 'managers-export.xlsx');
}

async function managersDownloadTemplate(): Promise<void> {
  const res = await apiClient.get('managers/template');
  await downloadExcelBlob(res, 'managers-import-template.xlsx');
}

// --- Parent Excel import/export (real API) -----------------------------------

export type ParentImportRowIssue = { row: number; errors: string[] };

export class ParentImportValidationError extends Error {
  readonly rowIssues: ParentImportRowIssue[];
  constructor(message: string, rowIssues: ParentImportRowIssue[]) {
    super(message);
    this.name = 'ParentImportValidationError';
    this.rowIssues = rowIssues;
  }
}

function isParentImportRowIssueArray(v: unknown): v is ParentImportRowIssue[] {
  return isStudentImportRowIssueArray(v);
}

async function parentsImportExcel(file: File): Promise<{ imported: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiRequest('parents/import', {
    method: 'POST',
    body: fd,
  });
  const body = await parseJson<Record<string, unknown>>(res);

  if (res.ok && isWrappedSuccess<{ imported: number }>(body) && body.error === null && body.data && typeof body.data === 'object') {
    const imported = (body.data as { imported?: number }).imported;
    if (typeof imported === 'number') return { imported };
  }

  const errPayload = body && typeof body === 'object' ? body : null;
  const errField = errPayload && 'error' in errPayload ? errPayload.error : undefined;
  if (isParentImportRowIssueArray(errField)) {
    throw new ParentImportValidationError(
      errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed',
      errField,
    );
  }

  const msg =
    errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed';
  throw new Error(msg);
}

export type ParentExportQuery = {
  levelId?: string;
  classId?: string;
  subjectId?: string;
  search?: string;
};

async function parentsExportExcel(params: ParentExportQuery): Promise<void> {
  const qs = buildQuery({
    levelId: params.levelId,
    classId: params.classId,
    subjectId: params.subjectId,
    search: params.search,
  });
  const res = await apiClient.get(`parents/export${qs}`);
  await downloadExcelBlob(res, 'parents-export.xlsx');
}

async function parentsDownloadTemplate(): Promise<void> {
  const res = await apiClient.get('parents/template');
  await downloadExcelBlob(res, 'parents-import-template.xlsx');
}

// --- Subject Excel import/export (real API) ---------------------------------

export type SubjectImportRowIssue = { row: number; errors: string[] };

export class SubjectImportValidationError extends Error {
  readonly rowIssues: SubjectImportRowIssue[];
  constructor(message: string, rowIssues: SubjectImportRowIssue[]) {
    super(message);
    this.name = 'SubjectImportValidationError';
    this.rowIssues = rowIssues;
  }
}

function isSubjectImportRowIssueArray(v: unknown): v is SubjectImportRowIssue[] {
  return isStudentImportRowIssueArray(v);
}

async function subjectsImportExcel(file: File): Promise<{ imported: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiRequest('subjects/import', {
    method: 'POST',
    body: fd,
  });
  const body = await parseJson<Record<string, unknown>>(res);

  if (res.ok && isWrappedSuccess<{ imported: number }>(body) && body.error === null && body.data && typeof body.data === 'object') {
    const imported = (body.data as { imported?: number }).imported;
    if (typeof imported === 'number') return { imported };
  }

  const errPayload = body && typeof body === 'object' ? body : null;
  const errField = errPayload && 'error' in errPayload ? errPayload.error : undefined;
  if (isSubjectImportRowIssueArray(errField)) {
    throw new SubjectImportValidationError(
      errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed',
      errField,
    );
  }

  const msg =
    errPayload && 'message' in errPayload ? firstMessageString(errPayload.message) : 'Import failed';
  throw new Error(msg);
}

export type SubjectExportQuery = {
  search?: string;
};

async function subjectsExportExcel(_params?: SubjectExportQuery): Promise<void> {
  const res = await apiClient.get('subjects/export');
  await downloadExcelBlob(res, 'subjects-export.xlsx');
}

async function subjectsDownloadTemplate(): Promise<void> {
  const res = await apiClient.get('subjects/template');
  await downloadExcelBlob(res, 'subjects-import-template.xlsx');
}

export type ClassExportQuery = {
  levelId?: string;
  search?: string;
};

async function classesExportExcel(_params?: ClassExportQuery): Promise<void> {
  const res = await apiClient.get('classes/export');
  await downloadExcelBlob(res, 'classes-export.xlsx');
}

const BACKEND_MAX_LIST_LIMIT = 100;

async function fetchAllListPages<R>(
  path: string,
  baseQuery: Record<string, string | number | undefined>,
  mapItem: (raw: unknown) => R,
): Promise<{ items: R[]; total: number; success: boolean; message: string; statusCode: number }> {
  let combined: R[] = [];
  let total = 0;
  let page = 1;
  let lastStatus = 200;
  let lastMessage = 'Success';
  let ok = true;

  while (true) {
    const qs = buildQuery({
      ...baseQuery,
      page,
      limit: BACKEND_MAX_LIST_LIMIT,
    });
    const res = await apiClient.get(`${path}${qs}`);
    const batch = await unwrapPaginated(res, mapItem);
    lastStatus = batch.statusCode;
    lastMessage = batch.message;
    if (!batch.success) {
      ok = false;
      break;
    }
    total = batch.total;
    combined = combined.concat(batch.data);
    if (combined.length >= total || batch.data.length < BACKEND_MAX_LIST_LIMIT) {
      break;
    }
    page += 1;
  }

  return {
    items: combined,
    total,
    success: ok,
    message: lastMessage,
    statusCode: lastStatus,
  };
}

// --- Student mappers ---------------------------------------------------------

type BackendStudentListRow = {
  id: string;
  code?: number;
  firstName: string;
  lastName: string;
  levelId: string;
  /** Resolved level name — populated from the list endpoint (join with levels) */
  levelName?: string;
  classId: string | null;
  /** Resolved class name — populated from the list endpoint (join with classes) */
  className?: string | null;
  imageId?: string | null;
  dynamicFields?: Record<string, unknown> | null;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type BackendStudentParent = { id: string; firstName: string; lastName: string };

type BackendStudentDetail = BackendStudentListRow & {
  levelName?: string;
  className?: string | null;
  parents?: BackendStudentParent[];
};

function toIso(d: unknown): string {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'string') return d;
  return new Date().toISOString();
}

function mapStudentFromListRow(row: BackendStudentListRow): Student {
  const df = (row.dynamicFields && typeof row.dynamicFields === 'object' ? row.dynamicFields : {}) as Record<
    string,
    unknown
  >;
  return {
    id: row.id,
    code: row.code,
    firstname: row.firstName,
    lastname: row.lastName,
    levelId: row.levelId,
    levelName: row.levelName,
    classId: row.classId ?? undefined,
    className: row.className ?? undefined,
    parentIds: [],
    dynamicFields: df as Record<string, unknown>,
    createdAt: toIso(row.createdAt),
  };
}

function mapStudentFromDetail(row: BackendStudentDetail): Student {
  const base = mapStudentFromListRow(row);
  const parents = Array.isArray(row.parents) ? row.parents : [];
  return {
    ...base,
    parentIds: parents.map((p) => p.id),
    parents: parents.map((p) => ({ id: p.id, firstname: p.firstName, lastname: p.lastName })),
    defaultParentId: parents.length === 1 ? parents[0].id : undefined,
  };
}

function buildStudentCreatePayload(data: Partial<Student> & { email?: string; password?: string }) {
  const dynamicFields = data.dynamicFields && typeof data.dynamicFields === 'object' ? data.dynamicFields : undefined;

  const body: Record<string, unknown> = {
    firstName: data.firstname ?? '',
    lastName: data.lastname ?? '',
    levelId: data.levelId ?? '',
    classId: data.classId || undefined,
    parentIds: data.parentIds?.length ? data.parentIds : undefined,
    dynamicFields,
  };

  const email = data.email?.trim();
  if (email) body.email = email;
  if (data.password && String(data.password).length >= 8) {
    body.password = String(data.password);
  }
  if (data.code != null && Number.isFinite(Number(data.code))) {
    body.code = Number(data.code);
  }

  return body;
}

/** Map DataTable column keys to backend `sortBy` query values. */
const STUDENT_SORT_QUERY: Record<string, string> = {
  code: 'code',
  firstname: 'firstName',
  lastname: 'lastName',
  levelId: 'levelId',
  classId: 'classId',
};

function buildStudentUpdatePayload(data: Partial<Student> & { password?: string }) {
  const out: Record<string, unknown> = {};
  if (data.firstname !== undefined) out.firstName = data.firstname;
  if (data.lastname !== undefined) out.lastName = data.lastname;
  if (data.levelId !== undefined) out.levelId = data.levelId;
  if (data.classId !== undefined) out.classId = data.classId === '' ? null : data.classId;
  if (data.parentIds !== undefined) out.parentIds = data.parentIds;
  if (data.dynamicFields !== undefined) out.dynamicFields = data.dynamicFields;
  if (data.password && String(data.password).length >= 8) out.password = String(data.password);
  return out;
}

// --- Teacher mappers ---------------------------------------------------------

type BackendTeacherListRow = {
  id: string;
  code?: number;
  firstName: string;
  lastName: string;
  imageId?: string | null;
  dynamicFields?: Record<string, unknown> | null;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Present on paginated list rows (backend join) */
  subjects?: BackendTeacherSubjectRef[];
  classes?: BackendTeacherClassRef[];
};

type BackendTeacherSubjectRef = { id: string; name: string };

type BackendTeacherClassRef = {
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
};

type BackendTeacherDetail = BackendTeacherListRow & {
  subjects?: BackendTeacherSubjectRef[];
  classes?: BackendTeacherClassRef[];
};

function expandClassAssignmentsForApi(assignments: ClassAssignment[]): { classId: string; subjectId: string }[] {
  const out: { classId: string; subjectId: string }[] = [];
  for (const a of assignments || []) {
    for (const sid of a.subjectIds || []) {
      out.push({ classId: a.classId, subjectId: sid });
    }
  }
  return out;
}

function collapseTeacherClassesToAssignments(
  classes: BackendTeacherClassRef[] | undefined,
): ClassAssignment[] {
  if (!Array.isArray(classes) || classes.length === 0) return [];
  const byClass = new Map<
    string,
    { subjectIds: string[]; className?: string; subjectNames: string[] }
  >();
  for (const c of classes) {
    const cur = byClass.get(c.classId) || { subjectIds: [], className: c.className, subjectNames: [] as string[] };
    if (!cur.subjectIds.includes(c.subjectId)) {
      cur.subjectIds.push(c.subjectId);
      cur.subjectNames.push(c.subjectName ?? '');
    }
    if (c.className) cur.className = c.className;
    byClass.set(c.classId, cur);
  }
  return [...byClass.entries()].map(([classId, v]) => ({
    classId,
    subjectIds: v.subjectIds,
    className: v.className,
    subjectNames: v.subjectNames,
  }));
}

function mapTeacherFromListRow(row: BackendTeacherListRow): Teacher {
  const df = (row.dynamicFields && typeof row.dynamicFields === 'object' ? row.dynamicFields : {}) as Record<
    string,
    unknown
  >;
  const subjects = Array.isArray(row.subjects) ? row.subjects : [];
  const classes = Array.isArray(row.classes) ? row.classes : [];
  const subjectIds = subjects.map((s) => s.id);
  const classAssignments = collapseTeacherClassesToAssignments(classes.length ? classes : undefined);
  const subjectNames = subjects.map((s) => s.name);
  const seenClass = new Set<string>();
  const classNames: string[] = [];
  for (const c of classes) {
    if (c.className && !seenClass.has(c.classId)) {
      seenClass.add(c.classId);
      classNames.push(c.className);
    }
  }
  return {
    id: row.id,
    code: row.code,
    firstname: row.firstName,
    lastname: row.lastName,
    email: typeof df.email === 'string' ? df.email : undefined,
    subjectIds,
    classAssignments,
    subjects: subjects.length ? subjects.map((s) => ({ id: s.id, name: s.name })) : undefined,
    subjectNames: subjectNames.length ? subjectNames : undefined,
    classNames: classNames.length ? classNames : undefined,
    dynamicFields: df as Record<string, unknown>,
    createdAt: toIso(row.createdAt),
  };
}

function mapTeacherFromDetail(row: BackendTeacherDetail): Teacher {
  return mapTeacherFromListRow(row);
}

function buildTeacherCreatePayload(data: Partial<Teacher> & { password?: string }) {
  const dynamicFields = data.dynamicFields && typeof data.dynamicFields === 'object' ? data.dynamicFields : undefined;
  const classes = expandClassAssignmentsForApi(data.classAssignments || []);

  const body: Record<string, unknown> = {
    firstName: data.firstname ?? '',
    lastName: data.lastname ?? '',
    subjectIds: data.subjectIds?.length ? data.subjectIds : [],
    classes,
    dynamicFields,
  };

  if (data.password && String(data.password).length >= 8) {
    body.password = String(data.password);
  }
  if (data.code != null && Number.isFinite(Number(data.code))) {
    body.code = Number(data.code);
  }

  return body;
}

function buildTeacherUpdatePayload(data: Partial<Teacher> & { password?: string }) {
  const out: Record<string, unknown> = {};
  if (data.firstname !== undefined) out.firstName = data.firstname;
  if (data.lastname !== undefined) out.lastName = data.lastname;
  if (data.subjectIds !== undefined) out.subjectIds = data.subjectIds;
  if (data.classAssignments !== undefined) {
    out.classes = expandClassAssignmentsForApi(data.classAssignments);
  }
  if (data.dynamicFields !== undefined) out.dynamicFields = data.dynamicFields;
  return out;
}

// --- Manager mappers -------------------------------------------------------

type BackendManagerClassRef = { id: string; name: string };

type BackendManagerListRow = {
  id: string;
  code?: number;
  firstName: string;
  lastName: string;
  imageId?: string | null;
  dynamicFields?: Record<string, unknown> | null;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  classes?: BackendManagerClassRef[];
};

type BackendManagerDetail = BackendManagerListRow & {
  classes?: BackendManagerClassRef[];
};

function mapManagerFromListRow(row: BackendManagerListRow): Manager {
  const df = (row.dynamicFields && typeof row.dynamicFields === 'object' ? row.dynamicFields : {}) as Record<
    string,
    unknown
  >;
  const classes = Array.isArray(row.classes) ? row.classes : [];
  return {
    id: row.id,
    code: row.code,
    firstname: row.firstName,
    lastname: row.lastName,
    classIds: classes.map((c) => c.id),
    classNames: classes.length ? classes.map((c) => c.name) : undefined,
    dynamicFields: df,
    createdAt: toIso(row.createdAt),
  };
}

function mapManagerFromDetail(row: BackendManagerDetail): Manager {
  return mapManagerFromListRow(row);
}

function buildManagerCreatePayload(data: Partial<Manager> & { email?: string; password?: string }) {
  const dynamicFields = data.dynamicFields && typeof data.dynamicFields === 'object' ? data.dynamicFields : undefined;

  const body: Record<string, unknown> = {
    firstName: data.firstname ?? '',
    lastName: data.lastname ?? '',
    classIds: data.classIds?.length ? data.classIds : undefined,
    dynamicFields,
  };

  const email = data.email?.trim();
  if (email) body.email = email;
  if (data.password && String(data.password).length >= 8) {
    body.password = String(data.password);
  }
  if (data.code != null && Number.isFinite(Number(data.code))) {
    body.code = Number(data.code);
  }

  return body;
}

function buildManagerUpdatePayload(data: Partial<Manager>) {
  const out: Record<string, unknown> = {};
  if (data.firstname !== undefined) out.firstName = data.firstname;
  if (data.lastname !== undefined) out.lastName = data.lastname;
  if (data.classIds !== undefined) out.classIds = data.classIds;
  if (data.dynamicFields !== undefined) out.dynamicFields = data.dynamicFields;
  return out;
}

// --- Parent mappers ----------------------------------------------------------

type BackendParentListRow = {
  id: string;
  code: number;
  firstName: string;
  lastName: string;
  dynamicFields?: Record<string, unknown> | null;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  studentCount?: number;
};

type BackendParentStudentRef = { id: string; firstName: string; lastName: string };

type BackendParentDetail = BackendParentListRow & {
  students?: BackendParentStudentRef[];
};

function mapParentFromListRow(row: BackendParentListRow): Parent {
  const df = (row.dynamicFields && typeof row.dynamicFields === 'object' ? row.dynamicFields : {}) as Record<
    string,
    unknown
  >;
  return {
    id: row.id,
    code: row.code,
    firstname: row.firstName,
    lastname: row.lastName,
    studentIds: [],
    studentCount: row.studentCount ?? 0,
    dynamicFields: df as Record<string, unknown>,
    createdAt: toIso(row.createdAt),
  };
}

function mapParentFromDetail(row: BackendParentDetail): Parent {
  const base = mapParentFromListRow(row);
  const students = Array.isArray(row.students) ? row.students : [];
  return {
    ...base,
    studentIds: students.map((s) => s.id),
    students: students.map((s) => ({ id: s.id, firstname: s.firstName, lastname: s.lastName })),
  };
}

function buildParentCreatePayload(data: Partial<Parent> & { password?: string }) {
  const dynamicFields = data.dynamicFields && typeof data.dynamicFields === 'object' ? data.dynamicFields : undefined;

  const body: Record<string, unknown> = {
    firstName: data.firstname ?? '',
    lastName: data.lastname ?? '',
    dynamicFields,
  };

  if (data.password && String(data.password).length >= 8) {
    body.password = String(data.password);
  }
  if (data.code != null && Number.isFinite(Number(data.code))) {
    body.code = Number(data.code);
  }

  return body;
}

/** Map DataTable column keys to backend `sortBy` query values (mock only; real API lists by code asc). */
const PARENT_SORT_QUERY: Record<string, string> = {
  code: 'code',
  firstname: 'firstName',
  lastname: 'lastName',
};

function buildParentUpdatePayload(data: Partial<Parent>) {
  const out: Record<string, unknown> = {};
  if (data.firstname !== undefined) out.firstName = data.firstname;
  if (data.lastname !== undefined) out.lastName = data.lastname;
  if (data.dynamicFields !== undefined) out.dynamicFields = data.dynamicFields;
  return out;
}

// --- Level mappers -----------------------------------------------------------

type BackendLevelSubjectRef = { id: string; name: string; code?: string };

type BackendLevelListItem = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  subjects?: BackendLevelSubjectRef[];
};

type BackendLevelDetailStudent = {
  id: string;
  code: number;
  firstName: string;
  lastName: string;
  classId: string | null;
};

type BackendLevelDetail = BackendLevelListItem & {
  students?: BackendLevelDetailStudent[];
  classes?: { id: string; name: string }[];
};

function mapLevelFromListItem(row: BackendLevelListItem): Level {
  const subjects = Array.isArray(row.subjects) ? row.subjects : [];
  return {
    id: row.id,
    name: row.name,
    description: '',
    subjectIds: subjects.map((s) => s.id),
    subjectNames: subjects.map((s) => s.name),
  };
}

function mapLevelFromDetail(row: BackendLevelDetail): Level {
  const base = mapLevelFromListItem(row);
  const subjects = Array.isArray(row.subjects)
    ? row.subjects.map((s) => ({
        id: s.id,
        name: s.name,
        code: typeof s.code === 'string' ? s.code : '',
      }))
    : [];
  const students = Array.isArray(row.students)
    ? row.students.map((s) => ({
        id: s.id,
        code: s.code,
        firstname: s.firstName,
        lastname: s.lastName,
        classId: s.classId,
      }))
    : [];
  return { ...base, subjects, students };
}

// --- Template helpers (real API) --------------------------------------------

const SCHEMA_PATH: Record<EntityType, string> = {
  student: 'settings/student-schema',
  teacher: 'settings/teacher-schema',
  manager: 'settings/manager-schema',
  parent: 'settings/parent-schema',
};

function emptyEntityConfig(): EntityTemplateConfig {
  return { fields: [], version: 1, lastUpdated: new Date().toISOString() };
}

async function fetchSchemaFields(path: string): Promise<EntityTemplateConfig['fields']> {
  const res = await apiClient.get(path);
  const unwrapped = await unwrapResponse<EntityTemplateConfig['fields']>(res);
  if (!unwrapped.success || !Array.isArray(unwrapped.data)) return [];
  return unwrapped.data;
}

// =============================================================================
// Mock implementation
// =============================================================================

const delay = () => new Promise((r) => setTimeout(r, APP_CONFIG.MOCK_DELAY));
let idCounter = 100;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;

let store: Record<string, any[]> = {
  students: [...initialStudents],
  teachers: [...initialTeachers],
  parents: [...initialParents],
  managers: [...initialManagers],
  classes: [...initialClasses],
  levels: [...initialLevels],
  subjects: [...initialSubjects],
};
let templates: TemplateConfig = JSON.parse(JSON.stringify(defaultTemplates));

function searchFilter<T extends Record<string, any>>(items: T[], search?: string): T[] {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter((item) =>
    Object.values(item).some((val) => {
      if (typeof val === 'string') return val.toLowerCase().includes(q);
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.values(val).some((v) => typeof v === 'string' && (v as string).toLowerCase().includes(q));
      }
      return false;
    }),
  );
}

function sortItems<T extends Record<string, any>>(items: T[], sortBy?: string, sortOrder?: 'asc' | 'desc'): T[] {
  if (!sortBy) return items;
  return [...items].sort((a, b) => {
    const aVal = String(a[sortBy] ?? a.dynamicFields?.[sortBy] ?? '');
    const bVal = String(b[sortBy] ?? b.dynamicFields?.[sortBy] ?? '');
    return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
  });
}

function createCrudService<T extends { id: string }>(key: string, prefix: string) {
  return {
    getAll: async (params: PaginationParams): Promise<PaginatedResponse<T>> => {
      await delay();
      let items = searchFilter(store[key] as T[], params.search);
      items = sortItems(items, params.sortBy, params.sortOrder);
      const total = items.length;
      const totalPages = Math.ceil(total / params.limit);
      const start = (params.page - 1) * params.limit;
      const data = items.slice(start, start + params.limit);
      return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages,
        message: 'Success',
        success: true,
        statusCode: 200,
      };
    },
    getById: async (id: string): Promise<ApiResponse<T | null>> => {
      await delay();
      const item = (store[key] as T[]).find((i) => i.id === id) || null;
      return { data: item, message: item ? 'Success' : 'Not found', success: !!item, statusCode: item ? 200 : 404 };
    },
    create: async (data: Partial<T>): Promise<ApiResponse<T>> => {
      await delay();
      const newItem = { ...data, id: genId(prefix), createdAt: new Date().toISOString() } as unknown as T;
      store[key] = [...store[key], newItem];
      return { data: newItem, message: 'Created successfully', success: true, statusCode: 201 };
    },
    update: async (id: string, data: Partial<T>): Promise<ApiResponse<T>> => {
      await delay();
      const items = store[key] as T[];
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
      items[idx] = { ...items[idx], ...data };
      store[key] = [...items];
      return { data: items[idx], message: 'Updated successfully', success: true, statusCode: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<null>> => {
      await delay();
      store[key] = (store[key] as T[]).filter((i) => i.id !== id);
      return { data: null, message: 'Deleted successfully', success: true, statusCode: 200 };
    },
  };
}

const _mockStudentCrud = createCrudService<Student>('students', 'stu');
const mockStudentApi = {
  ..._mockStudentCrud,
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Student>> => {
    await delay();
    let items = [...(store.students as Student[])];
    if (params.search?.trim()) {
      items = searchFilter(items, params.search);
    }
    if (params.levelId) {
      items = items.filter((s) => s.levelId === params.levelId);
    }
    if (params.classId) {
      items = items.filter((s) => s.classId === params.classId);
    }
    const sortKey = params.sortBy;
    if (sortKey) {
      const order = params.sortOrder === 'desc' ? 'desc' : 'asc';
      items = [...items].sort((a, b) => {
        const aVal = String((a as any)[sortKey] ?? a.dynamicFields?.[sortKey] ?? '');
        const bVal = String((b as any)[sortKey] ?? b.dynamicFields?.[sortKey] ?? '');
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
    } else {
      items = [...items].sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
    }
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit) || 0;
    const start = (params.page - 1) * params.limit;
    const levels = store.levels as Level[];
    const classes = store.classes as SchoolClass[];
    const data = items.slice(start, start + params.limit).map((s) => ({
      ...s,
      levelName: levels.find((l) => l.id === s.levelId)?.name,
      className: classes.find((c) => c.id === s.classId)?.name,
    }));
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
  create: async (data: Partial<Student>): Promise<ApiResponse<Student>> => {
    await delay();
    const existing = store.students as Student[];
    const maxCode = existing.reduce((m, s) => Math.max(m, typeof s.code === 'number' ? s.code : 0), 0);
    const nextCode = maxCode + 1;
    const code =
      data.code != null && Number.isFinite(Number(data.code)) ? Number(data.code) : nextCode;
    return _mockStudentCrud.create({ ...data, code });
  },

  regeneratePassword: async (_id: string): Promise<{ password: string }> => {
    await delay();
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return { password: pw };
  },

  importExcel: async (_file: File): Promise<{ imported: number }> => {
    await delay();
    return { imported: 0 };
  },

  exportExcel: async (_params?: StudentExportQuery): Promise<void> => {
    await delay();
  },

  downloadTemplate: async (): Promise<void> => {
    await delay();
  },

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    classId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Student>> => {
    await delay();
    let items = [...(store.students as Student[])];
    if (params.levelId) items = items.filter(s => s.levelId === params.levelId);
    if (params.classId) items = items.filter(s => s.classId === params.classId);
    if (params.search?.trim()) items = searchFilter(items, params.search);
    const req = [...new Set((params.requiredResult ?? []).filter(Boolean))];
    const byId = new Map((store.students as Student[]).map(s => [s.id, s]));
    const extras: Student[] = [];
    for (const id of req) {
      const row = byId.get(id);
      if (row && !extras.some(e => e.id === id)) extras.push(row);
    }
    const rest = items.filter(s => !req.includes(s.id));
    items = [...extras, ...rest].sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
    const total = items.length;
    const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return { data, total, page: params.page, limit: params.limit, totalPages, message: 'Success', success: true, statusCode: 200 };
  },
};

const _mockTeacherCrud = createCrudService<Teacher>('teachers', 'tea');
const mockTeacherApi = {
  ..._mockTeacherCrud,
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Teacher>> => {
    await delay();
    let items = [...(store.teachers as Teacher[])];
    if (params.search?.trim()) {
      items = searchFilter(items, params.search);
    }
    if (params.subjectId) {
      items = items.filter((t) => t.subjectIds.includes(params.subjectId!));
    }
    if (params.classId) {
      items = items.filter((t) => (t.classAssignments || []).some((a) => a.classId === params.classId));
    }
    if (params.levelId) {
      const levelClassIds = new Set(
        (store.classes as SchoolClass[]).filter((c) => c.levelId === params.levelId).map((c) => c.id),
      );
      items = items.filter((t) =>
        (t.classAssignments || []).some((a) => levelClassIds.has(a.classId)),
      );
    }
    const sortKey = params.sortBy;
    if (sortKey) {
      const order = params.sortOrder === 'desc' ? 'desc' : 'asc';
      items = [...items].sort((a, b) => {
        let aVal: string;
        let bVal: string;
        if (sortKey === 'subjectIds') {
          aVal = (a.subjectIds || []).join(',');
          bVal = (b.subjectIds || []).join(',');
        } else {
          aVal = String((a as Record<string, unknown>)[sortKey] ?? a.dynamicFields?.[sortKey] ?? '');
          bVal = String((b as Record<string, unknown>)[sortKey] ?? b.dynamicFields?.[sortKey] ?? '');
        }
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
    } else {
      items = [...items].sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
    }
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit) || 0;
    const start = (params.page - 1) * params.limit;
    const subs = store.subjects as Subject[];
    const classes = store.classes as SchoolClass[];
    const data = items.slice(start, start + params.limit).map((t) => {
      const subjectNames = (t.subjectIds || [])
        .map((id) => subs.find((s) => s.id === id)?.name)
        .filter(Boolean) as string[];
      const seen = new Set<string>();
      const classNames: string[] = [];
      for (const a of t.classAssignments || []) {
        const n = classes.find((c) => c.id === a.classId)?.name;
        if (n && !seen.has(a.classId)) {
          seen.add(a.classId);
          classNames.push(n);
        }
      }
      return {
        ...t,
        subjectNames: subjectNames.length ? subjectNames : undefined,
        classNames: classNames.length ? classNames : undefined,
      };
    });
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
  create: async (data: Partial<Teacher> & { password?: string }): Promise<ApiResponse<Teacher>> => {
    await delay();
    const existing = store.teachers as Teacher[];
    const maxCode = existing.reduce((m, t) => Math.max(m, typeof t.code === 'number' ? t.code : 0), 0);
    const nextCode = maxCode + 1;
    const code =
      data.code != null && Number.isFinite(Number(data.code)) ? Number(data.code) : nextCode;
    const dynamicFields = {
      ...(data.dynamicFields && typeof data.dynamicFields === 'object' ? data.dynamicFields : {}),
    } as Record<string, unknown>;
    return _mockTeacherCrud.create({
      ...data,
      code,
      subjectIds: data.subjectIds ?? [],
      classAssignments: data.classAssignments ?? [],
      dynamicFields,
    });
  },
  update: async (id: string, data: Partial<Teacher> & { password?: string }): Promise<ApiResponse<Teacher>> => {
    await delay();
    const items = store.teachers as Teacher[];
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    const prev = items[idx];
    const { password: _omitPw, ...patch } = data;
    const nextDynamic = { ...(prev.dynamicFields || {}) } as Record<string, unknown>;
    if (patch.dynamicFields !== undefined) {
      Object.assign(nextDynamic, patch.dynamicFields);
    }
    items[idx] = {
      ...prev,
      ...patch,
      dynamicFields: nextDynamic,
    } as Teacher;
    store.teachers = [...items];
    return { data: items[idx], message: 'Updated successfully', success: true, statusCode: 200 };
  },
  importExcel: async (_file: File): Promise<{ imported: number }> => {
    await delay();
    return { imported: 0 };
  },
  exportExcel: async (_params?: TeacherExportQuery): Promise<void> => {
    await delay();
  },
  downloadTemplate: async (): Promise<void> => {
    await delay();
  },

  regeneratePassword: async (_id: string): Promise<{ password: string }> => {
    await delay();
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return { password: pw };
  },

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    classId?: string;
    subjectId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Teacher>> => {
    await delay();
    let items = [...(store.teachers as Teacher[])];
    if (params.subjectId) items = items.filter(t => t.subjectIds.includes(params.subjectId!));
    if (params.classId) items = items.filter(t => (t.classAssignments || []).some(a => a.classId === params.classId));
    if (params.levelId) {
      const levelClassIds = new Set((store.classes as SchoolClass[]).filter(c => c.levelId === params.levelId).map(c => c.id));
      items = items.filter(t => (t.classAssignments || []).some(a => levelClassIds.has(a.classId)));
    }
    if (params.search?.trim()) items = searchFilter(items, params.search);
    const req = [...new Set((params.requiredResult ?? []).filter(Boolean))];
    const byId = new Map((store.teachers as Teacher[]).map(t => [t.id, t]));
    const extras: Teacher[] = [];
    for (const id of req) {
      const row = byId.get(id);
      if (row && !extras.some(e => e.id === id)) extras.push(row);
    }
    const rest = items.filter(t => !req.includes(t.id));
    items = [...extras, ...rest].sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
    const total = items.length;
    const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return { data, total, page: params.page, limit: params.limit, totalPages, message: 'Success', success: true, statusCode: 200 };
  },
};

const _mockManagerCrud = createCrudService<Manager>('managers', 'mgr');
const mockManagerApi = {
  ..._mockManagerCrud,
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Manager>> => {
    await delay();
    let items = [...(store.managers as Manager[])];
    if (params.search?.trim()) {
      items = searchFilter(items, params.search);
    }
    if (params.classId) {
      items = items.filter((m) => (m.classIds || []).includes(params.classId!));
    }
    if (params.levelId) {
      const levelClassIds = new Set(
        (store.classes as SchoolClass[]).filter((c) => c.levelId === params.levelId).map((c) => c.id),
      );
      items = items.filter((m) => (m.classIds || []).some((id) => levelClassIds.has(id)));
    }
    const sortKey = params.sortBy;
    if (sortKey) {
      const order = params.sortOrder === 'desc' ? 'desc' : 'asc';
      items = [...items].sort((a, b) => {
        const aVal = String(
          (a as Record<string, unknown>)[sortKey] ?? a.dynamicFields?.[sortKey] ?? '',
        );
        const bVal = String(
          (b as Record<string, unknown>)[sortKey] ?? b.dynamicFields?.[sortKey] ?? '',
        );
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
    } else {
      items = [...items].sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
    }
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit) || 0;
    const start = (params.page - 1) * params.limit;
    const classById = new Map((store.classes as SchoolClass[]).map((c) => [c.id, c]));
    const data = items.slice(start, start + params.limit).map((m) => {
      const names = (m.classIds || []).map((id) => classById.get(id)?.name).filter(Boolean) as string[];
      return { ...m, classNames: names.length ? names : m.classNames };
    });
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
  create: async (data: Partial<Manager> & { email?: string; password?: string }): Promise<ApiResponse<Manager>> => {
    await delay();
    const existing = store.managers as Manager[];
    const maxCode = existing.reduce((m, x) => Math.max(m, typeof x.code === 'number' ? x.code : 0), 0);
    const nextCode = maxCode + 1;
    const code =
      data.code != null && Number.isFinite(Number(data.code)) ? Number(data.code) : nextCode;
    const email = data.email?.trim();
    const dynamicFields = {
      ...(data.dynamicFields && typeof data.dynamicFields === 'object' ? data.dynamicFields : {}),
    } as Record<string, unknown>;
    if (email) dynamicFields.email = email;
    return _mockManagerCrud.create({
      ...data,
      code,
      classIds: data.classIds ?? [],
      dynamicFields,
    });
  },
  importExcel: async (_file: File): Promise<{ imported: number }> => {
    await delay();
    return { imported: 0 };
  },
  exportExcel: async (_params?: ManagerExportQuery): Promise<void> => {
    await delay();
  },
  downloadTemplate: async (): Promise<void> => {
    await delay();
  },

  regeneratePassword: async (_id: string): Promise<{ password: string }> => {
    await delay();
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return { password: pw };
  },

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    classId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Manager>> => {
    await delay();
    let items = [...(store.managers as Manager[])];
    if (params.classId) items = items.filter(m => (m.classIds || []).includes(params.classId!));
    if (params.levelId) {
      const levelClassIds = new Set((store.classes as SchoolClass[]).filter(c => c.levelId === params.levelId).map(c => c.id));
      items = items.filter(m => (m.classIds || []).some(id => levelClassIds.has(id)));
    }
    if (params.search?.trim()) items = searchFilter(items, params.search);
    const req = [...new Set((params.requiredResult ?? []).filter(Boolean))];
    const byId = new Map((store.managers as Manager[]).map(m => [m.id, m]));
    const extras: Manager[] = [];
    for (const id of req) {
      const row = byId.get(id);
      if (row && !extras.some(e => e.id === id)) extras.push(row);
    }
    const rest = items.filter(m => !req.includes(m.id));
    items = [...extras, ...rest].sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
    const total = items.length;
    const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return { data, total, page: params.page, limit: params.limit, totalPages, message: 'Success', success: true, statusCode: 200 };
  },
};

const _mockParentCrud = createCrudService<Parent>('parents', 'par');
async function mockParentSelectImpl(params: {
  page: number;
  limit: number;
  search?: string;
  levelId?: string;
  classId?: string;
  subjectId?: string;
  requiredResult?: string[];
}): Promise<PaginatedResponse<Parent>> {
  await delay();
  let items = [...(store.parents as Parent[])];
  const students = store.students as Student[];
  if (params.levelId) {
    items = items.filter((p) =>
      p.studentIds.some((sid) => students.find((s) => s.id === sid)?.levelId === params.levelId),
    );
  }
  if (params.classId) {
    items = items.filter((p) =>
      p.studentIds.some((sid) => students.find((s) => s.id === sid)?.classId === params.classId),
    );
  }
  if (params.subjectId) {
    const teachers = store.teachers as Teacher[];
    const classIdsWithSubject = new Set<string>();
    for (const t of teachers) {
      for (const a of t.classAssignments || []) {
        if (a.subjectIds.includes(params.subjectId!)) classIdsWithSubject.add(a.classId);
      }
    }
    items = items.filter((p) =>
      p.studentIds.some((sid) => {
        const clsId = students.find((s) => s.id === sid)?.classId;
        return clsId != null && classIdsWithSubject.has(clsId);
      }),
    );
  }
  if (params.search?.trim()) {
    items = searchFilter(items, params.search);
  }
  const req = [...new Set((params.requiredResult ?? []).filter(Boolean))];
  const extras: Parent[] = [];
  for (const id of req) {
    const row = (store.parents as Parent[]).find((p) => p.id === id);
    if (row && !extras.some((e) => e.id === id)) extras.push(row);
  }
  const rest = items.filter((p) => !req.includes(p.id));
  items = [...extras, ...rest];
  items.sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
  const total = items.length;
  const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
  const start = (params.page - 1) * params.limit;
  const data = items.slice(start, start + params.limit);
  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
    message: 'Success',
    success: true,
    statusCode: 200,
  };
}

const mockParentApi = {
  ..._mockParentCrud,
  select: mockParentSelectImpl,
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Parent>> => {
    await delay();
    let items = [...(store.parents as Parent[])];
    const students = store.students as Student[];
    if (params.levelId) {
      items = items.filter((p) =>
        p.studentIds.some((sid) => students.find((s) => s.id === sid)?.levelId === params.levelId),
      );
    }
    if (params.classId) {
      items = items.filter((p) =>
        p.studentIds.some((sid) => students.find((s) => s.id === sid)?.classId === params.classId),
      );
    }
    if (params.subjectId) {
      const teachers = store.teachers as Teacher[];
      const classIdsWithSubject = new Set<string>();
      for (const t of teachers) {
        for (const a of t.classAssignments || []) {
          if (a.subjectIds.includes(params.subjectId!)) classIdsWithSubject.add(a.classId);
        }
      }
      items = items.filter((p) =>
        p.studentIds.some((sid) => {
          const clsId = students.find((s) => s.id === sid)?.classId;
          return clsId != null && classIdsWithSubject.has(clsId);
        }),
      );
    }
    if (params.search?.trim()) {
      items = searchFilter(items, params.search);
    }
    const sortKey = params.sortBy;
    if (sortKey) {
      const apiField = PARENT_SORT_QUERY[sortKey] ?? sortKey;
      const order = params.sortOrder === 'desc' ? 'desc' : 'asc';
      items = [...items].sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        if (apiField === 'code' || sortKey === 'code') {
          aVal = typeof a.code === 'number' ? a.code : 0;
          bVal = typeof b.code === 'number' ? b.code : 0;
          return order === 'desc' ? bVal - aVal : aVal - bVal;
        }
        aVal = String((a as Record<string, unknown>)[sortKey] ?? a.dynamicFields?.[sortKey] ?? '');
        bVal = String((b as Record<string, unknown>)[sortKey] ?? b.dynamicFields?.[sortKey] ?? '');
        return order === 'desc' ? bVal.localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal));
      });
    } else {
      items = [...items].sort((a, b) => (a.code ?? 0) - (b.code ?? 0));
    }
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit) || 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
  create: async (data: Partial<Parent> & { password?: string }): Promise<ApiResponse<Parent>> => {
    await delay();
    const existing = store.parents as Parent[];
    const maxCode = existing.reduce((m, p) => Math.max(m, typeof p.code === 'number' ? p.code : 0), 0);
    const nextCode = maxCode + 1;
    const code =
      data.code != null && Number.isFinite(Number(data.code)) ? Number(data.code) : nextCode;
    const dynamicFields = {
      ...(data.dynamicFields && typeof data.dynamicFields === 'object' ? data.dynamicFields : {}),
    } as Record<string, unknown>;
    return _mockParentCrud.create({
      ...data,
      code,
      studentIds: data.studentIds ?? [],
      dynamicFields,
    });
  },
  regeneratePassword: async (_id: string): Promise<{ password: string }> => {
    await delay();
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return { password: pw };
  },

  update: async (id: string, data: Partial<Parent>): Promise<ApiResponse<Parent>> => {
    await delay();
    const items = store.parents as Parent[];
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return { data: null as any, message: 'Not found', success: false, statusCode: 404 };
    const prev = items[idx];
    const patch = data;
    const nextDynamic = { ...(prev.dynamicFields || {}) } as Record<string, unknown>;
    if (patch.dynamicFields !== undefined) {
      Object.assign(nextDynamic, patch.dynamicFields);
    }
    items[idx] = {
      ...prev,
      ...patch,
      dynamicFields: nextDynamic,
    } as Parent;
    store.parents = [...items];
    return { data: items[idx], message: 'Updated successfully', success: true, statusCode: 200 };
  },
  addStudent: async (parentId: string, studentId: string): Promise<ApiResponse<null>> => {
    await delay();
    const parents = store.parents as Parent[];
    const idx = parents.findIndex((p) => p.id === parentId);
    if (idx === -1) return { data: null, message: 'Parent not found', success: false, statusCode: 404 };
    const parent = parents[idx];
    if (parent.studentIds.includes(studentId)) {
      return { data: null, message: 'Already linked', success: false, statusCode: 409 };
    }
    parents[idx] = { ...parent, studentIds: [...parent.studentIds, studentId] };
    store.parents = [...parents];
    return { data: null, message: 'Student linked', success: true, statusCode: 200 };
  },

  removeStudent: async (parentId: string, studentId: string): Promise<ApiResponse<null>> => {
    await delay();
    const parents = store.parents as Parent[];
    const idx = parents.findIndex((p) => p.id === parentId);
    if (idx === -1) return { data: null, message: 'Parent not found', success: false, statusCode: 404 };
    const parent = parents[idx];
    if (!parent.studentIds.includes(studentId)) {
      return { data: null, message: 'Not linked', success: false, statusCode: 400 };
    }
    parents[idx] = { ...parent, studentIds: parent.studentIds.filter((id) => id !== studentId) };
    store.parents = [...parents];
    return { data: null, message: 'Student unlinked', success: true, statusCode: 200 };
  },

  importExcel: async (_file: File): Promise<{ imported: number }> => {
    await delay();
    return { imported: 0 };
  },
  exportExcel: async (_params?: ParentExportQuery): Promise<void> => {
    await delay();
  },
  downloadTemplate: async (): Promise<void> => {
    await delay();
  },
};

const _mockSubjectCrud = createCrudService<Subject>('subjects', 'sub');
const mockSubjectApi = {
  ..._mockSubjectCrud,
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Subject>> => {
    await delay();
    let items = [...(store.subjects as Subject[])];
    if (params.search?.trim()) {
      items = searchFilter(items, params.search);
    }
    const sortKey = params.sortBy;
    if (sortKey) {
      const order = params.sortOrder === 'desc' ? 'desc' : 'asc';
      items = [...items].sort((a, b) => {
        const aVal = String((a as Record<string, unknown>)[sortKey] ?? '');
        const bVal = String((b as Record<string, unknown>)[sortKey] ?? '');
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
    } else {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    }
    const total = items.length;
    const totalPages = Math.ceil(total / params.limit) || 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
  importExcel: async (_file: File): Promise<{ imported: number }> => {
    await delay();
    return { imported: 0 };
  },
  exportExcel: async (_params?: SubjectExportQuery): Promise<void> => {
    await delay();
  },
  downloadTemplate: async (): Promise<void> => {
    await delay();
  },

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Subject>> => {
    await delay();
    let items = [...(store.subjects as Subject[])];
    if (params.search?.trim()) items = searchFilter(items, params.search);
    const req = [...new Set((params.requiredResult ?? []).filter(Boolean))];
    const byId = new Map((store.subjects as Subject[]).map((s) => [s.id, s]));
    const extras: Subject[] = [];
    for (const id of req) {
      const row = byId.get(id);
      if (row && !extras.some((e) => e.id === id)) extras.push(row);
    }
    const rest = items.filter((s) => !req.includes(s.id));
    items = [...extras, ...rest];
    items.sort((a, b) => a.name.localeCompare(b.name));
    const total = items.length;
    const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
};

const _mockLevelCrud = createCrudService<Level>('levels', 'lvl');
const mockLevelApi = {
  ..._mockLevelCrud,
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Level>> => {
    const res = await _mockLevelCrud.getAll(params);
    if (!res.success) return res;
    const subs = store.subjects as Subject[];
    const data = res.data.map((l) => ({
      ...l,
      subjectNames: (l.subjectIds || [])
        .map((id) => subs.find((s) => s.id === id)?.name)
        .filter((n): n is string => Boolean(n)),
    }));
    return { ...res, data };
  },
  getById: async (id: string): Promise<ApiResponse<Level | null>> => {
    const res = await _mockLevelCrud.getById(id);
    if (!res.success || !res.data) return res;
    const item = res.data;
    const subs = store.subjects as Subject[];
    const subjects = (item.subjectIds || [])
      .map((sid) => subs.find((s) => s.id === sid))
      .filter((s): s is Subject => Boolean(s))
      .map((s) => ({ id: s.id, name: s.name, code: s.code }));
    const subjectNames = subjects.map((s) => s.name);
    const students = (store.students as Student[])
      .filter((s) => s.levelId === id)
      .map((s) => ({
        id: s.id,
        code: s.code,
        firstname: s.firstname,
        lastname: s.lastname,
        classId: s.classId ?? null,
      }));
    return {
      ...res,
      data: { ...item, subjects, students, subjectNames },
    };
  },
  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Level>> => {
    await delay();
    let items = [...(store.levels as Level[])];
    if (params.search?.trim()) items = searchFilter(items, params.search);
    const req = [...new Set((params.requiredResult ?? []).filter(Boolean))];
    const byId = new Map((store.levels as Level[]).map((l) => [l.id, l]));
    const extras: Level[] = [];
    for (const id of req) {
      const row = byId.get(id);
      if (row && !extras.some((e) => e.id === id)) extras.push(row);
    }
    const rest = items.filter((l) => !req.includes(l.id));
    items = [...extras, ...rest];
    items.sort((a, b) => a.name.localeCompare(b.name));
    const total = items.length;
    const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
};

const _mockClassCrud = createCrudService<SchoolClass>('classes', 'cls');
const mockClassApi = {
  ..._mockClassCrud,
  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<SchoolClass>> => {
    await delay();
    let items = [...(store.classes as SchoolClass[])];
    if (params.search?.trim()) items = searchFilter(items, params.search);
    if (params.levelId) items = items.filter((c) => c.levelId === params.levelId);
    const req = [...new Set((params.requiredResult ?? []).filter(Boolean))];
    const byId = new Map((store.classes as SchoolClass[]).map((c) => [c.id, c]));
    const extras: SchoolClass[] = [];
    for (const id of req) {
      const row = byId.get(id);
      if (row && !extras.some((e) => e.id === id)) extras.push(row);
    }
    const rest = items.filter((c) => !req.includes(c.id));
    items = [...extras, ...rest];
    items.sort((a, b) => a.name.localeCompare(b.name));
    const total = items.length;
    const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<SchoolClass>> => {
    await delay();
    let items = [...(store.classes as SchoolClass[])];
    if (params.search?.trim()) {
      items = searchFilter(items, params.search);
    }
    if (params.levelId) {
      items = items.filter((c) => c.levelId === params.levelId);
    }
    const sortKey = params.sortBy;
    if (sortKey) {
      const order = params.sortOrder === 'desc' ? 'desc' : 'asc';
      items = [...items].sort((a, b) => {
        const aVal = String((a as Record<string, unknown>)[sortKey] ?? '');
        const bVal = String((b as Record<string, unknown>)[sortKey] ?? '');
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
    } else {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    }
    const total = items.length;
    const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message: 'Success',
      success: true,
      statusCode: 200,
    };
  },
  importExcel: async (_file: File): Promise<{ imported: number }> => {
    await delay();
    return { imported: 0 };
  },
  exportExcel: async (_params?: ClassExportQuery): Promise<void> => {
    await delay();
  },
  downloadTemplate: async (): Promise<void> => {
    await delay();
  },
};

const mockTemplateApi = {
  get: async (): Promise<ApiResponse<TemplateConfig>> => {
    await delay();
    return { data: JSON.parse(JSON.stringify(templates)), message: 'Success', success: true, statusCode: 200 };
  },
  update: async (entityType: EntityType, config: EntityTemplateConfig): Promise<ApiResponse<EntityTemplateConfig>> => {
    await delay();
    templates[entityType] = { ...config, version: config.version + 1, lastUpdated: new Date().toISOString() };
    return { data: templates[entityType], message: 'Template updated', success: true, statusCode: 200 };
  },
  reset: async (entityType: EntityType): Promise<ApiResponse<EntityTemplateConfig>> => {
    await delay();
    templates[entityType] = JSON.parse(JSON.stringify(defaultTemplates[entityType]));
    return { data: templates[entityType], message: 'Template reset', success: true, statusCode: 200 };
  },
};

// =============================================================================
// Real API implementation
// =============================================================================

const realStudentApi = {
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Student>> => {
    const sortByApi =
      params.sortBy && STUDENT_SORT_QUERY[params.sortBy]
        ? STUDENT_SORT_QUERY[params.sortBy]
        : undefined;
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      sortBy: sortByApi,
      sortOrder: params.sortOrder,
      levelId: params.levelId,
      classId: params.classId,
    });
    const res = await apiClient.get(`students${qs}`);
    return unwrapPaginated(res, (raw) => mapStudentFromListRow(raw as BackendStudentListRow));
  },

  getById: async (id: string): Promise<ApiResponse<Student | null>> => {
    const res = await apiClient.get(`students/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<BackendStudentDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapStudentFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Partial<Student> & { email?: string; password?: string }): Promise<ApiResponse<Student>> => {
    const body = buildStudentCreatePayload(data);
    const res = await apiClient.post('students', body);
    const out = await unwrapResponse<BackendStudentListRow>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapStudentFromListRow(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  update: async (id: string, data: Partial<Student> & { password?: string }): Promise<ApiResponse<Student>> => {
    const body = buildStudentUpdatePayload(data);
    const res = await apiClient.patch(`students/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendStudentListRow>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapStudentFromListRow(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`students/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  regeneratePassword: async (id: string): Promise<{ password: string }> => {
    const res = await apiClient.patch(`students/${encodeURIComponent(id)}/regenerate-password`, {});
    const out = await unwrapResponse<{ password: string }>(res);
    if (!out.success || out.data === null) throw new Error(out.message);
    return out.data;
  },

  importExcel: studentsImportExcel,

  exportExcel: studentsExportExcel,

  downloadTemplate: studentsDownloadTemplate,

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    classId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Student>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      levelId: params.levelId,
      classId: params.classId,
      requiredResult: params.requiredResult,
    });
    const res = await apiClient.get(`students/select${qs}`);
    return unwrapPaginated(res, (raw) => mapStudentFromListRow(raw as BackendStudentListRow));
  },
};

const realTeacherApi = {
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Teacher>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      levelId: params.levelId,
      classId: params.classId,
      subjectId: params.subjectId,
    });
    const res = await apiClient.get(`teachers${qs}`);
    return unwrapPaginated(res, (raw) => mapTeacherFromListRow(raw as BackendTeacherListRow));
  },

  getById: async (id: string): Promise<ApiResponse<Teacher | null>> => {
    const res = await apiClient.get(`teachers/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<BackendTeacherDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapTeacherFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Partial<Teacher> & { password?: string }): Promise<ApiResponse<Teacher>> => {
    const body = buildTeacherCreatePayload(data);
    const res = await apiClient.post('teachers', body);
    const out = await unwrapResponse<BackendTeacherListRow>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapTeacherFromListRow(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  update: async (id: string, data: Partial<Teacher> & { password?: string }): Promise<ApiResponse<Teacher>> => {
    const body = buildTeacherUpdatePayload(data);
    const res = await apiClient.patch(`teachers/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendTeacherListRow>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapTeacherFromListRow(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`teachers/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  regeneratePassword: async (id: string): Promise<{ password: string }> => {
    const res = await apiClient.patch(`teachers/${encodeURIComponent(id)}/regenerate-password`, {});
    const out = await unwrapResponse<{ password: string }>(res);
    if (!out.success || out.data === null) throw new Error(out.message);
    return out.data;
  },

  importExcel: teachersImportExcel,

  exportExcel: teachersExportExcel,

  downloadTemplate: teachersDownloadTemplate,

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    classId?: string;
    subjectId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Teacher>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      levelId: params.levelId,
      classId: params.classId,
      subjectId: params.subjectId,
      requiredResult: params.requiredResult,
    });
    const res = await apiClient.get(`teachers/select${qs}`);
    return unwrapPaginated(res, (raw) => mapTeacherFromListRow(raw as BackendTeacherListRow));
  },
};

const realManagerApi = {
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Manager>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      classId: params.classId,
      levelId: params.levelId,
    });
    const res = await apiClient.get(`managers${qs}`);
    return unwrapPaginated(res, (raw) => mapManagerFromListRow(raw as BackendManagerListRow));
  },

  getById: async (id: string): Promise<ApiResponse<Manager | null>> => {
    const res = await apiClient.get(`managers/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<BackendManagerDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapManagerFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Partial<Manager> & { email?: string; password?: string }): Promise<ApiResponse<Manager>> => {
    const body = buildManagerCreatePayload(data);
    const res = await apiClient.post('managers', body);
    const out = await unwrapResponse<BackendManagerListRow>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapManagerFromListRow(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  update: async (id: string, data: Partial<Manager>): Promise<ApiResponse<Manager>> => {
    const body = buildManagerUpdatePayload(data);
    const res = await apiClient.patch(`managers/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendManagerListRow>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapManagerFromListRow(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`managers/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  regeneratePassword: async (id: string): Promise<{ password: string }> => {
    const res = await apiClient.patch(
      `managers/${encodeURIComponent(id)}/regenerate-password`,
      {},
    );
    const out = await unwrapResponse<{ password: string }>(res);
    if (!out.success || out.data === null) throw new Error(out.message);
    return out.data;
  },

  importExcel: managersImportExcel,

  exportExcel: managersExportExcel,

  downloadTemplate: managersDownloadTemplate,

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    classId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Manager>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      levelId: params.levelId,
      classId: params.classId,
      requiredResult: params.requiredResult,
    });
    const res = await apiClient.get(`managers/select${qs}`);
    return unwrapPaginated(res, (raw) => mapManagerFromListRow(raw as BackendManagerListRow));
  },
};

const realLevelApi = {
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Level>> => {
    const { items, total, success, message, statusCode } = await fetchAllListPages(
      'levels',
      { search: params.search },
      (raw) => mapLevelFromListItem(raw as BackendLevelListItem),
    );
    const start = (params.page - 1) * params.limit;
    const data = items.slice(start, start + params.limit);
    const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      message,
      success,
      statusCode,
    };
  },

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Level>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      requiredResult: params.requiredResult?.length ? params.requiredResult.join(',') : undefined,
    });
    const res = await apiClient.get(`levels/select${qs}`);
    return unwrapPaginated(res, (raw) => mapLevelFromListItem(raw as BackendLevelListItem));
  },

  getById: async (id: string): Promise<ApiResponse<Level | null>> => {
    const res = await apiClient.get(`levels/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<BackendLevelDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapLevelFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Partial<Level>): Promise<ApiResponse<Level>> => {
    const body = {
      name: data.name ?? '',
      subjectIds: data.subjectIds ?? [],
    };
    const res = await apiClient.post('levels', body);
    const out = await unwrapResponse<BackendLevelDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapLevelFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  update: async (id: string, data: Partial<Level>): Promise<ApiResponse<Level>> => {
    // Backend DTO only allows name + subjectIds (no description — would fail forbidNonWhitelisted).
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.subjectIds !== undefined) body.subjectIds = data.subjectIds;
    const res = await apiClient.patch(`levels/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendLevelDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapLevelFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`levels/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },
};

const realTemplateApi = {
  get: async (): Promise<ApiResponse<TemplateConfig>> => {
    const [studentF, teacherF, managerF, parentF] = await Promise.all([
      fetchSchemaFields(SCHEMA_PATH.student),
      fetchSchemaFields(SCHEMA_PATH.teacher),
      fetchSchemaFields(SCHEMA_PATH.manager),
      fetchSchemaFields(SCHEMA_PATH.parent),
    ]);
    const now = new Date().toISOString();
    const data: TemplateConfig = {
      student: { fields: studentF, version: 1, lastUpdated: now },
      teacher: { fields: teacherF, version: 1, lastUpdated: now },
      manager: { fields: managerF, version: 1, lastUpdated: now },
      parent: { fields: parentF, version: 1, lastUpdated: now },
    };
    return { data, message: 'Success', success: true, statusCode: 200 };
  },

  update: async (entityType: EntityType, config: EntityTemplateConfig): Promise<ApiResponse<EntityTemplateConfig>> => {
    const path = SCHEMA_PATH[entityType];
    const res = await apiClient.put(path, { fields: config.fields });
    const out = await unwrapResponse<EntityTemplateConfig['fields']>(res);
    if (!out.success) {
      return { data: config, message: out.message, success: false, statusCode: out.statusCode };
    }
    const fields = Array.isArray(out.data) ? out.data : config.fields;
    const updated: EntityTemplateConfig = {
      ...config,
      fields,
      version: config.version + 1,
      lastUpdated: new Date().toISOString(),
    };
    return { data: updated, message: out.message, success: true, statusCode: out.statusCode };
  },

  reset: async (entityType: EntityType): Promise<ApiResponse<EntityTemplateConfig>> => {
    const def = JSON.parse(JSON.stringify(defaultTemplates[entityType])) as EntityTemplateConfig;
    return realTemplateApi.update(entityType, def);
  },
};

const realParentApi = {
  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Parent>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      levelId: params.levelId,
      classId: params.classId,
      subjectId: params.subjectId,
    });
    const res = await apiClient.get(`parents${qs}`);
    return unwrapPaginated(res, (raw) => mapParentFromListRow(raw as BackendParentListRow));
  },

  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    classId?: string;
    subjectId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Parent>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      levelId: params.levelId,
      classId: params.classId,
      subjectId: params.subjectId,
      requiredResult: params.requiredResult?.length ? params.requiredResult.join(',') : undefined,
    });
    const res = await apiClient.get(`parents/select${qs}`);
    return unwrapPaginated(res, (raw) => mapParentFromListRow(raw as BackendParentListRow));
  },

  getById: async (id: string): Promise<ApiResponse<Parent | null>> => {
    const res = await apiClient.get(`parents/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<BackendParentDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapParentFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Partial<Parent> & { password?: string }): Promise<ApiResponse<Parent>> => {
    const body = buildParentCreatePayload(data);
    const res = await apiClient.post('parents', body);
    const out = await unwrapResponse<BackendParentListRow>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapParentFromListRow(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  update: async (id: string, data: Partial<Parent>): Promise<ApiResponse<Parent>> => {
    const body = buildParentUpdatePayload(data);
    const res = await apiClient.patch(`parents/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendParentListRow>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapParentFromListRow(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`parents/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  regeneratePassword: async (id: string): Promise<{ password: string }> => {
    const res = await apiClient.patch(
      `parents/${encodeURIComponent(id)}/regenerate-password`,
      {},
    );
    const out = await unwrapResponse<{ password: string }>(res);
    if (!out.success || out.data === null) throw new Error(out.message);
    return out.data;
  },

  addStudent: async (parentId: string, studentId: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.post(`parents/${encodeURIComponent(parentId)}/students`, { studentId });
    return unwrapVoid(res);
  },

  removeStudent: async (parentId: string, studentId: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`parents/${encodeURIComponent(parentId)}/students/${encodeURIComponent(studentId)}`);
    return unwrapVoid(res);
  },

  importExcel: parentsImportExcel,

  exportExcel: parentsExportExcel,

  downloadTemplate: parentsDownloadTemplate,
};

type BackendSubjectListRow = {
  id: string;
  name: string;
  code: string;
  type?: string;
};

type BackendSubjectDetail = {
  id: string;
  name: string;
  code: string;
  type?: string;
  parent?: { id: string; name: string; code: string } | null;
  children?: { id: string; name: string; code: string }[];
  createdAt?: string;
  updatedAt?: string;
  levels?: { id: string; name: string }[];
  teachers?: { id: string; code: number; firstName: string; lastName: string }[];
};

function mapSubjectFromListRow(row: BackendSubjectListRow): Subject {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: '',
    type: (row.type as Subject['type']) ?? 'NORMAL',
  };
}

function mapSubjectFromDetail(d: BackendSubjectDetail): Subject {
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    description: '',
    type: (d.type as Subject['type']) ?? 'NORMAL',
    parent: d.parent ?? null,
    children: d.children ?? [],
    levels: (d.levels ?? []).map((l) => ({ id: l.id, name: l.name })),
    teachers: (d.teachers ?? []).map((t) => ({
      id: t.id,
      code: t.code,
      firstname: t.firstName,
      lastname: t.lastName,
    })),
  };
}

const realSubjectApi = {
  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<Subject>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      requiredResult: params.requiredResult?.length ? params.requiredResult.join(',') : undefined,
    });
    const res = await apiClient.get(`subjects/select${qs}`);
    return unwrapPaginated(res, (raw) => mapSubjectFromListRow(raw as BackendSubjectListRow));
  },

  getAll: async (params: PaginationParams): Promise<PaginatedResponse<Subject>> => {
    if (params.sortBy) {
      const { items, total, success, message, statusCode } = await fetchAllListPages(
        'subjects',
        { search: params.search },
        (raw) => mapSubjectFromListRow(raw as BackendSubjectListRow),
      );
      let list = [...items];
      const sortKey = params.sortBy;
      const order = params.sortOrder === 'desc' ? 'desc' : 'asc';
      list.sort((a, b) => {
        const aVal = String((a as Record<string, unknown>)[sortKey] ?? '');
        const bVal = String((b as Record<string, unknown>)[sortKey] ?? '');
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      });
      const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0;
      const start = (params.page - 1) * params.limit;
      const data = list.slice(start, start + params.limit);
      return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages,
        message,
        success,
        statusCode,
      };
    }
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
    });
    const res = await apiClient.get(`subjects${qs}`);
    return unwrapPaginated(res, (raw) => mapSubjectFromListRow(raw as BackendSubjectListRow));
  },

  getById: async (id: string): Promise<ApiResponse<Subject | null>> => {
    const res = await apiClient.get(`subjects/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<BackendSubjectDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapSubjectFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Partial<Subject> & { childIds?: string[] }): Promise<ApiResponse<Subject>> => {
    const body: Record<string, unknown> = { name: data.name ?? '', code: data.code ?? '' };
    if (data.type) body.type = data.type;
    if (data.childIds) body.childIds = data.childIds;
    const res = await apiClient.post('subjects', body);
    const out = await unwrapResponse<BackendSubjectDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapSubjectFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  update: async (id: string, data: Partial<Subject> & { childIds?: string[] }): Promise<ApiResponse<Subject>> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.code !== undefined) body.code = data.code;
    if (data.type !== undefined) body.type = data.type;
    if (data.childIds !== undefined) body.childIds = data.childIds;
    const res = await apiClient.patch(`subjects/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendSubjectDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapSubjectFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`subjects/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  importExcel: subjectsImportExcel,

  exportExcel: subjectsExportExcel,

  downloadTemplate: subjectsDownloadTemplate,
};

// --- Classes (real API) ------------------------------------------------------

type BackendClassListRow = {
  id: string;
  name: string;
  levelId: string;
  capacity: number;
  createdAt?: string;
  updatedAt?: string;
  level?: { id: string; name: string };
};

type BackendClassPersonRef = {
  id: string;
  code?: number;
  firstName?: string;
  lastName?: string;
  firstname?: string;
  lastname?: string;
  createdAt?: string;
};

type BackendClassDetail = BackendClassListRow & {
  students?: BackendClassPersonRef[];
  managers?: BackendClassPersonRef[];
};

function mapClassPersonRef(p: BackendClassPersonRef): {
  id: string;
  code?: number;
  firstname: string;
  lastname: string;
  createdAt?: string;
} {
  const firstname = p.firstname ?? p.firstName ?? '';
  const lastname = p.lastname ?? p.lastName ?? '';
  return { id: p.id, code: p.code, firstname, lastname, createdAt: p.createdAt };
}

function mapClassFromListRow(raw: BackendClassListRow): SchoolClass {
  return {
    id: raw.id,
    name: raw.name,
    levelId: raw.levelId,
    capacity: raw.capacity,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    level: raw.level ? { id: raw.level.id, name: raw.level.name } : undefined,
  };
}

/** Select endpoint returns id, name, levelId (capacity optional). */
function mapClassFromSelectRow(raw: unknown): SchoolClass {
  const r = raw as { id: string; name: string; levelId?: string; capacity?: number };
  return mapClassFromListRow({
    id: r.id,
    name: r.name,
    levelId: r.levelId ?? '',
    capacity: typeof r.capacity === 'number' && Number.isFinite(r.capacity) ? r.capacity : 0,
    createdAt: undefined,
    updatedAt: undefined,
    level: undefined,
  });
}

function mapClassFromDetail(raw: BackendClassDetail): SchoolClass {
  const base = mapClassFromListRow(raw);
  return {
    ...base,
    students: raw.students?.map(mapClassPersonRef),
    managers: raw.managers?.map((m) => {
      const r = mapClassPersonRef(m);
      return { id: r.id, code: r.code, firstname: r.firstname, lastname: r.lastname };
    }),
  };
}

const realClassApi = {
  select: async (params: {
    page: number;
    limit: number;
    search?: string;
    levelId?: string;
    requiredResult?: string[];
  }): Promise<PaginatedResponse<SchoolClass>> => {
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      levelId: params.levelId,
      requiredResult: params.requiredResult?.length ? params.requiredResult.join(',') : undefined,
    });
    const res = await apiClient.get(`classes/select${qs}`);
    return unwrapPaginated(res, (raw) => mapClassFromSelectRow(raw));
  },

  getAll: async (params: PaginationParams): Promise<PaginatedResponse<SchoolClass>> => {
    const CLASS_SORT_FIELDS = new Set(['name', 'capacity', 'levelId']);
    const sortByApi =
      params.sortBy && CLASS_SORT_FIELDS.has(params.sortBy) ? params.sortBy : undefined;
    const qs = buildQuery({
      page: params.page,
      limit: params.limit,
      search: params.search,
      levelId: params.levelId,
      sortBy: sortByApi,
      sortOrder: params.sortOrder,
    });
    const res = await apiClient.get(`classes${qs}`);
    return unwrapPaginated(res, (raw) => mapClassFromListRow(raw as BackendClassListRow));
  },

  getById: async (id: string): Promise<ApiResponse<SchoolClass | null>> => {
    const res = await apiClient.get(`classes/${encodeURIComponent(id)}`);
    const out = await unwrapResponse<BackendClassDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapClassFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  create: async (data: Partial<SchoolClass>): Promise<ApiResponse<SchoolClass>> => {
    const body = {
      name: data.name ?? '',
      levelId: data.levelId ?? '',
      capacity: typeof data.capacity === 'number' && Number.isFinite(data.capacity) ? data.capacity : 30,
    };
    const res = await apiClient.post('classes', body);
    const out = await unwrapResponse<BackendClassDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapClassFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  update: async (id: string, data: Partial<SchoolClass>): Promise<ApiResponse<SchoolClass>> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.levelId !== undefined) body.levelId = data.levelId;
    if (data.capacity !== undefined) body.capacity = data.capacity;
    const res = await apiClient.patch(`classes/${encodeURIComponent(id)}`, body);
    const out = await unwrapResponse<BackendClassDetail>(res);
    if (!out.success || out.data === null) {
      return { data: null as any, message: out.message, success: false, statusCode: out.statusCode };
    }
    return {
      data: mapClassFromDetail(out.data),
      message: out.message,
      success: true,
      statusCode: out.statusCode,
    };
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await apiClient.delete(`classes/${encodeURIComponent(id)}`);
    return unwrapVoid(res);
  },

  importExcel: async (_file: File): Promise<{ imported: number }> => {
    throw new Error('Classes import is not available on the server.');
  },

  exportExcel: classesExportExcel,

  downloadTemplate: async (): Promise<void> => {
    throw new Error('Classes import template is not available on the server.');
  },
};

// =============================================================================
// Exports
// =============================================================================

export const studentApi = APP_CONFIG.USE_MOCK_API ? mockStudentApi : realStudentApi;
export const levelApi = APP_CONFIG.USE_MOCK_API ? mockLevelApi : realLevelApi;
export const templateApi = APP_CONFIG.USE_MOCK_API ? mockTemplateApi : realTemplateApi;

export const teacherApi = APP_CONFIG.USE_MOCK_API ? mockTeacherApi : realTeacherApi;
export const parentApi = APP_CONFIG.USE_MOCK_API ? mockParentApi : realParentApi;
export const managerApi = APP_CONFIG.USE_MOCK_API ? mockManagerApi : realManagerApi;
export const classApi = APP_CONFIG.USE_MOCK_API ? mockClassApi : realClassApi;
export const subjectApi = APP_CONFIG.USE_MOCK_API ? mockSubjectApi : realSubjectApi;
