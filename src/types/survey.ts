export type SurveyQuestionType = 'multiple_choice' | 'text' | 'rating' | 'pros_cons';

export interface SurveyOption {
  id: string;
  text: string;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  text: string;
  options?: SurveyOption[]; // for multiple_choice
  order: number;
}

export type NoteColor = 'info' | 'warn' | 'danger';
export type NotePosition = 'beginning' | 'end';

export interface SurveyNote {
  id: string;
  text: string;
  color: NoteColor;
  position: NotePosition;
}

export type SurveyTargetType = 'class' | 'level';
export type SurveyDistribution = 'link' | 'student_app';

export interface Survey {
  id: string;
  title: string;
  targetType: SurveyTargetType;
  targetIds: string[];
  distribution: SurveyDistribution;
  questions: SurveyQuestion[];
  notes: SurveyNote[];
  status: 'draft' | 'active' | 'closed';
  createdAt: string;
  responsesCount: number;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  studentId?: string;
  answers: Record<string, any>; // questionId -> answer
  submittedAt: string;
}
