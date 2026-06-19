import type { ApprovalStatus } from './index';

export type AttendanceEntityType = 'student' | 'teacher' | 'manager';
export type AttendanceRecordType = 'absence' | 'late';

export interface StudentAbsence {
  id: string;
  studentId: string;
  date: string;
  isJustified: boolean;
  reason?: string;
  status: ApprovalStatus;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface StudentLate {
  id: string;
  studentId: string;
  date: string;
  isJustified: boolean;
  reason?: string;
  period: number;
  status: ApprovalStatus;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface TeacherAbsence {
  id: string;
  teacherId: string;
  /** UUID of the session (replaces plain string label) */
  sessionId: string;
  /** Human-readable session name resolved from settings */
  sessionName?: string;
  date: string;
  isJustified: boolean;
  reason?: string;
  status: ApprovalStatus;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface TeacherLate {
  id: string;
  teacherId: string;
  /** UUID of the session (replaces plain string label) */
  sessionId: string;
  /** Human-readable session name resolved from settings */
  sessionName?: string;
  date: string;
  isJustified: boolean;
  reason?: string;
  period: number;
  status: ApprovalStatus;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface ManagerAbsence {
  id: string;
  managerId: string;
  date: string;
  isJustified: boolean;
  reason?: string;
  status: ApprovalStatus;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface ManagerLate {
  id: string;
  managerId: string;
  date: string;
  isJustified: boolean;
  reason?: string;
  period: number;
  status: ApprovalStatus;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface AttendanceStats {
  totalAbsences: number;
  justifiedAbsences: number;
  unjustifiedAbsences: number;
  totalLates: number;
  justifiedLates: number;
  unjustifiedLates: number;
  averageLatePeriod: number;
}

export interface AttendanceFilter {
  dateFrom?: string;
  dateTo?: string;
  classId?: string;
  levelId?: string;
  /** subjectId is only relevant for teacher attendance */
  subjectId?: string;
  entityId?: string;
  isJustified?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedAttendanceResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  success: boolean;
  message: string;
  statusCode: number;
}
