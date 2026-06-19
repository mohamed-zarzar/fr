export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type QuestionType = 'true_false' | 'multiple_choice';

export interface Unit {
  id: string;
  name: string;
  subjectId: string;
  levelId: string;
  order: number;
  createdAt: string;
}

export interface Lesson {
  id: string;
  name: string;
  description: string;
  subjectId: string;
  levelId: string;
  unitId: string;
  order: number;
  createdAt: string;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  lessonId: string;
  text: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  options: QuestionOption[];
  correctAnswerId: string;
  createdAt: string;
}

export interface ExamConfig {
  name: string;
  levelId: string;
  subjectId: string;
  lessonIds: string[];
  mode: 'manual' | 'auto';
  maxScore: number;
  // For auto mode
  easyCount?: number;
  mediumCount?: number;
  hardCount?: number;
  // For manual mode
  questionIds?: string[];
}

export interface Exam {
  id: string;
  name: string;
  levelId: string;
  subjectId: string;
  lessonIds: string[];
  questionIds: string[];
  maxScore: number;
  createdAt: string;
  status: 'draft' | 'published';
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  answers: Record<string, string>; // questionId -> selectedOptionId
  score: number;
  totalQuestions: number;
  completedAt: string;
}

export interface ExternalExam {
  id: string;
  name: string;
  totalQuestions: number;
  answerKey: Record<number, string>; // questionNum -> correct option (A/B/C/D)
  createdAt: string;
}

export interface ExternalExamAttempt {
  id: string;
  externalExamId: string;
  studentId: string;
  answers: Record<number, string | null>; // questionNum -> selected option
  score: number;
  totalQuestions: number;
  completedAt: string;
}
