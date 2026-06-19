import type { ApprovalStatus } from './index';

export interface NoteTemplate {
  id: string;
  title: string;
  type: 'positive' | 'negative';
  isPointEffect: boolean;
  pointEffect: number;
  isSendNotification: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  templateId: string;
  studentId: string;
  date: string;
  description?: string;
  status: ApprovalStatus;
  createdAt: string;
}

export interface PointRecord {
  id: string;
  studentId: string;
  type: 'positive' | 'negative';
  amount: number;
  date: string;
  sourceNoteId?: string;
  createdAt: string;
}
