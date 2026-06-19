export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type FieldType = 'text' | 'date' | 'select' | 'multi-select' | 'file' | 'number' | 'email' | 'phone' | 'textarea';

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: { value: string; label: string }[];
  validation?: { min?: number; max?: number; pattern?: string; customMessage?: string };
  placeholder?: string;
  defaultValue?: any;
  order: number;
  visible: boolean;
  editable: boolean;
}

export interface EntityTemplateConfig {
  fields: FieldDefinition[];
  version: number;
  lastUpdated: string;
}

export interface TemplateConfig {
  student: EntityTemplateConfig;
  teacher: EntityTemplateConfig;
  manager: EntityTemplateConfig;
  parent: EntityTemplateConfig;
}

export type EntityType = 'student' | 'teacher' | 'manager' | 'parent';

export interface StudentParentRef {
  id: string;
  firstname: string;
  lastname: string;
}

export interface Student {
  id: string;
  firstname: string;
  lastname: string;
  /** Backend student code (numeric id) when using real API */
  code?: number;
  /** Login email for student user (create / detail from API) */
  email?: string;
  parentIds: string[];
  /** Parent objects with names, populated from getById detail endpoint */
  parents?: StudentParentRef[];
  defaultParentId?: string;
  parentRelations?: Record<string, string>;
  classId?: string;
  /** Resolved level name (populated from list endpoint join) */
  levelName?: string;
  levelId: string;
  /** Resolved class name (populated from list endpoint join) */
  className?: string;
  dynamicFields: Record<string, any>;
  createdAt: string;
}

export interface ClassAssignment {
  classId: string;
  subjectIds: string[];
  /** Resolved class name (detail / join) */
  className?: string;
  /** Resolved subject names parallel to subjectIds (detail) */
  subjectNames?: string[];
}

export interface Teacher {
  id: string;
  firstname: string;
  lastname: string;
  /** Backend teacher code (numeric id) when using real API */
  code?: number;
  /** Login email for teacher user (create / detail from API) */
  email?: string;
  subjectIds: string[];
  classAssignments: ClassAssignment[];
  /** Subject id+name from detail endpoint */
  subjects?: { id: string; name: string }[];
  /** Resolved subject names (list endpoint join) */
  subjectNames?: string[];
  /** Unique class names for list display (list endpoint join) */
  classNames?: string[];
  dynamicFields: Record<string, any>;
  createdAt: string;
}

export interface Parent {
  id: string;
  /** Backend parent code when using real API */
  code?: number;
  firstname: string;
  lastname: string;
  studentIds: string[];
  /** Total number of linked students returned by the list endpoint */
  studentCount?: number;
  /** From getById join — id + names for related students */
  students?: Array<{
    id: string;
    firstname: string;
    lastname: string;
    /** When present (e.g. full student row), relation label per parent id */
    parentRelations?: Record<string, string>;
  }>;
  dynamicFields: Record<string, any>;
  createdAt: string;
}

export interface Manager {
  id: string;
  /** Backend manager code when using real API */
  code?: number;
  firstname: string;
  lastname: string;
  classIds: string[];
  /** Resolved class names (list/detail join), parallel order to classIds when from API */
  classNames?: string[];
  dynamicFields: Record<string, any>;
  createdAt: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  /** Mock / legacy UI only — backend classes API has no section field */
  section?: string;
  capacity: number;
  levelId: string;
  createdAt?: string;
  level?: { id: string; name: string };
  students?: Array<{ id: string; code?: number; firstname: string; lastname: string; createdAt?: string }>;
  managers?: Array<{ id: string; code?: number; firstname: string; lastname: string }>;
}

/** Subjects embedded on level detail (from API join). */
export interface LevelEmbeddedSubject {
  id: string;
  name: string;
  code: string;
}

/** Students embedded on level detail (from API join). */
export interface LevelEmbeddedStudent {
  id: string;
  code?: number;
  firstname: string;
  lastname: string;
  classId?: string | null;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  subjectIds: string[];
  /** Subject names in list order — from levels list API join (same order as subjectIds). */
  subjectNames?: string[];
  subjects?: LevelEmbeddedSubject[];
  students?: LevelEmbeddedStudent[];
}

export type SubjectType = 'NORMAL' | 'MAIN';

export interface SubjectParentRef {
  id: string;
  name: string;
  code: string;
}

export interface SubjectChildRef {
  id: string;
  name: string;
  code: string;
}

export interface SubjectLevelRef {
  id: string;
  name: string;
}

export interface SubjectTeacherRef {
  id: string;
  code?: number;
  firstname: string;
  lastname: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description: string;
  type: SubjectType;
  parent?: SubjectParentRef | null;
  children?: SubjectChildRef[];
  childCount?: number;
  levels?: SubjectLevelRef[];
  teachers?: SubjectTeacherRef[];
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  message: string;
  success: boolean;
  statusCode: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  levelId?: string;
  classId?: string;
  /** Teacher list filter */
  subjectId?: string;
}
