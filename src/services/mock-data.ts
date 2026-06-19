import type { TemplateConfig, Student, Teacher, Parent, Manager, SchoolClass, Level, Subject } from '@/types';
import type { StudentAbsence, StudentLate, TeacherAbsence, TeacherLate, ManagerAbsence, ManagerLate } from '@/types/attendance';
import type { Unit, Lesson, Question } from '@/types/exam';

export const defaultTemplates: TemplateConfig = {
  student: {
    fields: [
      { name: 'date_of_birth', label: 'تاريخ الميلاد', type: 'date', required: true, order: 1, visible: true, editable: true, placeholder: '' },
      { name: 'gender', label: 'الجنس', type: 'select', required: true, options: [{ value: 'male', label: 'ذكر' }, { value: 'female', label: 'أنثى' }, { value: 'other', label: 'آخر' }], order: 2, visible: true, editable: true },
      { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: false, order: 3, visible: true, editable: true, placeholder: 'student@school.com' },
      { name: 'phone', label: 'الهاتف', type: 'phone', required: false, order: 4, visible: true, editable: true, placeholder: '+1 234 567 890' },
      { name: 'address', label: 'العنوان', type: 'textarea', required: false, order: 5, visible: true, editable: true, placeholder: 'العنوان الكامل' },
      { name: 'blood_group', label: 'فصيلة الدم', type: 'select', required: false, options: [{ value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' }, { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' }, { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' }, { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' }], order: 6, visible: true, editable: true },
    ],
    version: 1,
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  teacher: {
    fields: [
      { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: true, order: 1, visible: true, editable: true, placeholder: 'teacher@school.com' },
      { name: 'phone', label: 'الهاتف', type: 'phone', required: false, order: 2, visible: true, editable: true },
      { name: 'qualification', label: 'المؤهل العلمي', type: 'text', required: false, order: 3, visible: true, editable: true, placeholder: 'مثل: ماجستير، دكتوراه' },
      { name: 'experience_years', label: 'سنوات الخبرة', type: 'number', required: false, order: 4, visible: true, editable: true },
    ],
    version: 1,
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  manager: {
    fields: [
      { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: true, order: 1, visible: true, editable: true },
      { name: 'phone', label: 'الهاتف', type: 'phone', required: false, order: 2, visible: true, editable: true },
      { name: 'department', label: 'القسم', type: 'text', required: false, order: 3, visible: true, editable: true },
    ],
    version: 1,
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  parent: {
    fields: [
      { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: true, order: 1, visible: true, editable: true },
      { name: 'phone', label: 'الهاتف', type: 'phone', required: true, order: 2, visible: true, editable: true },
      { name: 'address', label: 'العنوان', type: 'textarea', required: false, order: 3, visible: true, editable: true },
      { name: 'occupation', label: 'المهنة', type: 'text', required: false, order: 4, visible: true, editable: true },
    ],
    version: 1,
    lastUpdated: '2024-01-01T00:00:00Z',
  },
};

export const initialLevels: Level[] = [
  { id: 'lvl-1', name: 'الابتدائي', description: 'مرحلة التعليم الابتدائي (الصفوف 1-5)', subjectIds: ['sub-1', 'sub-2', 'sub-3'] },
  { id: 'lvl-2', name: 'الإعدادي', description: 'مرحلة التعليم الإعدادي (الصفوف 6-8)', subjectIds: ['sub-1', 'sub-2', 'sub-3', 'sub-4'] },
  { id: 'lvl-3', name: 'الثانوي', description: 'مرحلة التعليم الثانوي (الصفوف 9-12)', subjectIds: ['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5'] },
];

export const initialClasses: SchoolClass[] = [
  { id: 'cls-1', name: '1A', section: 'A', capacity: 30, levelId: 'lvl-1' },
  { id: 'cls-2', name: '1B', section: 'B', capacity: 30, levelId: 'lvl-1' },
  { id: 'cls-3', name: '6A', section: 'A', capacity: 25, levelId: 'lvl-2' },
  { id: 'cls-4', name: '6B', section: 'B', capacity: 25, levelId: 'lvl-2' },
  { id: 'cls-5', name: '9A', section: 'A', capacity: 20, levelId: 'lvl-3' },
  { id: 'cls-6', name: '9B', section: 'B', capacity: 20, levelId: 'lvl-3' },
];

export const initialSubjects: Subject[] = [
  { id: 'sub-1', name: 'الرياضيات', code: 'MATH', description: 'الرياضيات الأساسية', type: 'NORMAL', parent: null, children: [] },
  { id: 'sub-2', name: 'اللغة الإنجليزية', code: 'ENG', description: 'اللغة الإنجليزية وآدابها', type: 'NORMAL', parent: null, children: [] },
  { id: 'sub-3', name: 'العلوم', code: 'SCI', description: 'مادة رئيسية تجمع العلوم', type: 'MAIN', parent: null, children: [{ id: 'sub-6', name: 'الفيزياء', code: 'PHY' }, { id: 'sub-7', name: 'الكيمياء', code: 'CHEM' }] },
  { id: 'sub-4', name: 'التاريخ', code: 'HIST', description: 'تاريخ العالم', type: 'NORMAL', parent: null, children: [] },
  { id: 'sub-5', name: 'التربية الفنية', code: 'ART', description: 'الفنون البصرية', type: 'NORMAL', parent: null, children: [] },
  { id: 'sub-6', name: 'الفيزياء', code: 'PHY', description: 'فيزياء', type: 'NORMAL', parent: { id: 'sub-3', name: 'العلوم', code: 'SCI' }, children: [] },
  { id: 'sub-7', name: 'الكيمياء', code: 'CHEM', description: 'كيمياء', type: 'NORMAL', parent: { id: 'sub-3', name: 'العلوم', code: 'SCI' }, children: [] },
];

export const initialParents: Parent[] = [
  { id: 'par-1', code: 1, firstname: 'عبد الرحمن', lastname: 'العلي', studentIds: ['stu-1', 'stu-5'], dynamicFields: { email: 'robert.doe@email.com', phone: '+1 555 0101', address: 'شارع الملك فهد 123', occupation: 'مهندس' }, createdAt: '2024-01-10T08:00:00Z' },
  { id: 'par-2', code: 2, firstname: 'سارة', lastname: 'الزهراني', studentIds: ['stu-2'], dynamicFields: { email: 'sarah.smith@email.com', phone: '+1 555 0102', occupation: 'طبيبة' }, createdAt: '2024-01-10T08:00:00Z' },
  { id: 'par-3', code: 3, firstname: 'خالد', lastname: 'المنصوري', studentIds: ['stu-3'], dynamicFields: { email: 'tom.j@email.com', phone: '+1 555 0103', occupation: 'معلم' }, createdAt: '2024-01-11T08:00:00Z' },
  { id: 'par-4', code: 4, firstname: 'ليلى', lastname: 'الإدريسي', studentIds: ['stu-4'], dynamicFields: { email: 'lisa.w@email.com', phone: '+1 555 0104', address: 'طريق المدينة المنورة 789', occupation: 'محامية' }, createdAt: '2024-01-11T08:00:00Z' },
];

export const initialStudents: Student[] = [
  { id: 'stu-1', code: 1, firstname: 'أحمد', lastname: 'العلي', parentIds: ['par-1'], defaultParentId: 'par-1', parentRelations: { 'par-1': 'الأب' }, classId: 'cls-1', levelId: 'lvl-1', dynamicFields: { date_of_birth: '2015-05-15', gender: 'male', email: 'john.doe@school.com', blood_group: 'A+' }, createdAt: '2024-01-15T10:00:00Z' },
  { id: 'stu-2', code: 2, firstname: 'مريم', lastname: 'الزهراني', parentIds: ['par-2'], defaultParentId: 'par-2', parentRelations: { 'par-2': 'الأم' }, classId: 'cls-2', levelId: 'lvl-1', dynamicFields: { date_of_birth: '2015-08-22', gender: 'female', blood_group: 'B+' }, createdAt: '2024-01-15T10:00:00Z' },
  { id: 'stu-3', code: 3, firstname: 'يوسف', lastname: 'المنصوري', parentIds: ['par-3'], defaultParentId: 'par-3', parentRelations: { 'par-3': 'الأب' }, classId: 'cls-3', levelId: 'lvl-2', dynamicFields: { date_of_birth: '2012-03-10', gender: 'male', blood_group: 'O+' }, createdAt: '2024-02-01T10:00:00Z' },
  { id: 'stu-4', code: 4, firstname: 'فاطمة', lastname: 'الإدريسي', parentIds: ['par-4'], defaultParentId: 'par-4', parentRelations: { 'par-4': 'الأم' }, classId: 'cls-4', levelId: 'lvl-2', dynamicFields: { date_of_birth: '2012-11-05', gender: 'female', address: 'طريق المدينة المنورة 789' }, createdAt: '2024-02-01T10:00:00Z' },
  { id: 'stu-5', code: 5, firstname: 'عمر', lastname: 'العلي', parentIds: ['par-1'], defaultParentId: 'par-1', parentRelations: { 'par-1': 'الأب' }, classId: 'cls-5', levelId: 'lvl-3', dynamicFields: { date_of_birth: '2009-07-20', gender: 'male', phone: '+1 555 9999' }, createdAt: '2024-02-15T10:00:00Z' },
];

export const initialTeachers: Teacher[] = [
  { id: 'tea-1', firstname: 'عائشة', lastname: 'بن علي', subjectIds: ['sub-1', 'sub-2'], classAssignments: [{ classId: 'cls-1', subjectIds: ['sub-1'] }, { classId: 'cls-2', subjectIds: ['sub-1', 'sub-2'] }], dynamicFields: { email: 'alice.cooper@school.com', phone: '+1 555 1001', qualification: 'ماجستير في الرياضيات', experience_years: '8' }, createdAt: '2024-01-05T08:00:00Z' },
  { id: 'tea-2', firstname: 'محمد', lastname: 'الفاسي', subjectIds: ['sub-3'], classAssignments: [{ classId: 'cls-3', subjectIds: ['sub-3'] }, { classId: 'cls-4', subjectIds: ['sub-3'] }], dynamicFields: { email: 'bob.martin@school.com', qualification: 'دكتوراه في العلوم', experience_years: '12' }, createdAt: '2024-01-05T08:00:00Z' },
  { id: 'tea-3', firstname: 'خديجة', lastname: 'بن سعيد', subjectIds: ['sub-4', 'sub-5'], classAssignments: [{ classId: 'cls-5', subjectIds: ['sub-4'] }, { classId: 'cls-6', subjectIds: ['sub-4', 'sub-5'] }], dynamicFields: { email: 'carol.davis@school.com', phone: '+1 555 1003', experience_years: '5' }, createdAt: '2024-01-06T08:00:00Z' },
];

export const initialManagers: Manager[] = [
  { id: 'mgr-1', code: 1, firstname: 'حسن', lastname: 'العلوي', classIds: ['cls-1', 'cls-2', 'cls-3'], dynamicFields: { email: 'frank.w@school.com', phone: '+1 555 2001', department: 'الشؤون الأكاديمية' }, createdAt: '2024-01-03T08:00:00Z' },
  { id: 'mgr-2', code: 2, firstname: 'نورة', lastname: 'البراك', classIds: ['cls-4', 'cls-5', 'cls-6'], dynamicFields: { email: 'grace.t@school.com', phone: '+1 555 2002', department: 'الإدارة' }, createdAt: '2024-01-03T08:00:00Z' },
];
