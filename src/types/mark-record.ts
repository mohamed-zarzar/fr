import type { ApprovalStatus } from './index';

export interface MarkRecordType {
  id: string;
  name: string;
}

export interface ColumnFormula {
  op: 'sum' | 'average';
  columnIds: string[];
}

export interface OfficialTemplateColumn {
  id: string;
  name: string;
  maxScore: number;
  order: number;
  kind?: 'input' | 'computed';
  formula?: ColumnFormula;
}

export interface OfficialTemplate {
  id: string;
  name: string;
  levelId: string;
  columns: OfficialTemplateColumn[];
}

export interface NonOfficialMarkRecord {
  id: string;
  studentId: string;
  subjectId: string;
  levelId?: string;
  classId?: string;
  typeId: string;
  score: number;
  maxScore: number;
  date: string;
  notes: string;
  isOfficial: false;
  status: ApprovalStatus;
  createdAt: string;
}

export interface OfficialMarkRecord {
  id: string;
  studentId: string;
  subjectId: string;
  levelId?: string;
  classId?: string;
  templateId: string;
  scores: Record<string, number>;
  date: string;
  notes: string;
  isOfficial: true;
  status: ApprovalStatus;
  createdAt: string;
}

export type MarkRecord = NonOfficialMarkRecord | OfficialMarkRecord;

export interface MarkRecordSettings {
  types: MarkRecordType[];
  officialTemplates: OfficialTemplate[];
}
