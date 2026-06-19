import {
  LayoutDashboard, GraduationCap, Users, UserCircle, Briefcase,
  School, Layers, BookOpen, Settings, ChevronDown, GraduationCap as EduIcon,
  CalendarCheck, ClipboardList, FileQuestion, Library, FileText, Award,
  StickyNote, Star, FileStack, CalendarClock, ClipboardCheck, Shield,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useMemo, useState } from 'react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@/hooks/usePermissions';

type SidebarItem = {
  titleKey: string;
  url: string;
  icon: LucideIcon;
  /** Required permission name (e.g. `students.index`). Omit to show for any authenticated user. */
  permission?: string;
  /** When true, item is only shown to users with userType MANAGER. */
  managerOnly?: boolean;
};

type SidebarSection = {
  key: string;
  labelKey: string;
  items: SidebarItem[];
};

const sections: SidebarSection[] = [
  {
    key: 'management',
    labelKey: 'nav.management',
    items: [
      { titleKey: 'nav.students', url: '/students', icon: GraduationCap, permission: 'students.index' },
      { titleKey: 'nav.teachers', url: '/teachers', icon: Users, permission: 'teachers.index' },
      { titleKey: 'nav.parents', url: '/parents', icon: UserCircle, permission: 'parents.index' },
      { titleKey: 'nav.managers', url: '/managers', icon: Briefcase, permission: 'managers.index' },
      { titleKey: 'nav.classes', url: '/classes', icon: School, permission: 'classes.index' },
      { titleKey: 'nav.levels', url: '/levels', icon: Layers, permission: 'levels.index' },
      { titleKey: 'nav.subjects', url: '/subjects', icon: BookOpen, permission: 'subjects.index' },
    ],
  },
  {
    key: 'attendance',
    labelKey: 'nav.attendance',
    items: [
      { titleKey: 'nav.studentAttendance', url: '/attendance/students', icon: CalendarCheck, permission: 'student-attendance.index' },
      { titleKey: 'nav.teacherAttendance', url: '/attendance/teachers', icon: ClipboardList, permission: 'teacher-attendance.index' },
      { titleKey: 'nav.managerAttendance', url: '/attendance/managers', icon: CalendarCheck, permission: 'manager-attendance.index' },
    ],
  },
  {
    key: 'exam',
    labelKey: 'nav.onlineExam',
    items: [
      { titleKey: 'nav.lessons', url: '/lessons', icon: Library, permission: 'lessons.index' },
      { titleKey: 'nav.questions', url: '/questions', icon: FileQuestion, permission: 'questions.index' },
      { titleKey: 'nav.markRecords', url: '/mark-records', icon: Award, permission: 'mark-records.index' },
      { titleKey: 'nav.exams', url: '/exams', icon: FileText, permission: 'exams.index' },
      { titleKey: 'nav.externalExams', url: '/external-exams', icon: ClipboardList, permission: 'external_exams.index' },
    ],
  },
  {
    key: 'notepoint',
    labelKey: 'nav.notePoint',
    items: [
      { titleKey: 'nav.noteTemplates', url: '/note-templates', icon: FileStack, permission: 'note-templates.index' },
      { titleKey: 'nav.notes', url: '/notes', icon: StickyNote, permission: 'notes.index' },
      { titleKey: 'nav.points', url: '/points', icon: Star, permission: 'points.index' },
    ],
  },
  {
    key: 'surveys',
    labelKey: 'nav.surveys',
    items: [
      { titleKey: 'nav.surveys', url: '/surveys', icon: ClipboardCheck, permission: 'surveys.index' },
    ],
  },
  {
    key: 'timetable',
    labelKey: 'nav.timetable',
    items: [
      { titleKey: 'nav.timetable', url: '/timetable', icon: CalendarClock },
    ],
  },
  {
    key: 'administration',
    labelKey: 'nav.administration',
    items: [
      {
        titleKey: 'nav.roles',
        url: '/roles',
        icon: Shield,
        permission: 'access-control.index',
        managerOnly: true,
      },
    ],
  },
];

function canShowItem(
  item: SidebarItem,
  hasPermission: (permission: string) => boolean,
  isManager: boolean,
): boolean {
  if (item.managerOnly && !isManager) return false;
  if (item.permission && !hasPermission(item.permission)) return false;
  return true;
}

export function AppSidebar() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [openSection, setOpenSection] = useState<string | null>('management');
  const { hasPermission, isManager } = usePermissions();

  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => canShowItem(item, hasPermission, isManager)),
        }))
        .filter((section) => section.items.length > 0),
    [hasPermission, isManager],
  );

  const toggleSection = (key: string) => {
    setOpenSection((prev) => (prev === key ? null : key));
  };

  return (
    <Sidebar className="border-r-0" side={isRTL ? 'right' : 'left'}>
      <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <EduIcon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-bold text-sm tracking-tight text-sidebar-foreground">EduManage</h2>
          <p className="text-xs text-sidebar-foreground/50">School Management</p>
        </div>
      </div>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/"
                    end
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    activeClassName="!bg-primary !text-primary-foreground font-medium"
                  >
                    <LayoutDashboard className="h-[18px] w-[18px]" />
                    <span className="text-sm">{t('nav.dashboard')}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleSections.map((section) => (
          <SidebarGroup key={section.key}>
            <Collapsible open={openSection === section.key} onOpenChange={() => toggleSection(section.key)}>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors">
                <span>{t(section.labelKey)}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', openSection === section.key && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.titleKey}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                            activeClassName="!bg-primary !text-primary-foreground font-medium"
                          >
                            <item.icon className="h-[18px] w-[18px]" />
                            <span className="text-sm">{t(item.titleKey)}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        ))}

        <div className="flex-1" />

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/settings"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    activeClassName="!bg-primary !text-primary-foreground font-medium"
                  >
                    <Settings className="h-[18px] w-[18px]" />
                    <span className="text-sm">{t('nav.settings')}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
