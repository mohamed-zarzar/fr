import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const labelKeyMap: Record<string, string> = {
  students: 'nav.students',
  teachers: 'nav.teachers',
  parents: 'nav.parents',
  managers: 'nav.managers',
  classes: 'nav.classes',
  levels: 'nav.levels',
  subjects: 'nav.subjects',
  settings: 'nav.settings',
  attendance: 'nav.attendance',
  exams: 'nav.exams',
  lessons: 'nav.lessons',
  questions: 'nav.questions',
  'mark-records': 'nav.markRecords',
  'external-exams': 'nav.externalExams',
  'note-templates': 'nav.noteTemplates',
  notes: 'nav.notes',
  points: 'nav.points',
  timetable: 'nav.timetable',
  roles: 'nav.roles',
};

export function Breadcrumbs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  if (pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link to="/" className="hover:text-foreground"><Home className="h-3.5 w-3.5" /></Link>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = labelKeyMap[seg] ? t(labelKeyMap[seg]) : seg;
        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 rtl:rotate-180" />
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link to={path} className="hover:text-foreground">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
