import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentAttendanceApi } from '@/services/attendance-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { format, endOfWeek, endOfMonth, subWeeks, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface StudentAttendanceStatsTabProps {
  studentId: string;
  studentName: string;
}

const COLORS = {
  absences: 'hsl(var(--destructive))',
  lates: 'hsl(var(--warning, 38 92% 50%))',
  justified: 'hsl(142 76% 36%)',
  unjustified: 'hsl(var(--destructive))',
};

type ViewMode = 'daily' | 'weekly' | 'monthly';

export function StudentAttendanceStatsTab({ studentId, studentName }: StudentAttendanceStatsTabProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [range, setRange] = useState('4');

  const { data: absencesRes, isLoading: loadingAbs } = useQuery({
    queryKey: ['student-absences', studentId],
    queryFn: () => studentAttendanceApi.getAbsences({ entityId: studentId }),
  });

  const { data: latesRes, isLoading: loadingLates } = useQuery({
    queryKey: ['student-lates', studentId],
    queryFn: () => studentAttendanceApi.getLates({ entityId: studentId }),
  });

  const absences = absencesRes?.data || [];
  const lates = latesRes?.data || [];
  const isLoading = loadingAbs || loadingLates;

  const chartData = useMemo(() => {
    const now = new Date();
    const rangeNum = parseInt(range);

    if (viewMode === 'daily') {
      const days = eachDayOfInterval({ start: subWeeks(now, rangeNum), end: now });
      return days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayAbsences = absences.filter(a => a.date === dateStr);
        const dayLates = lates.filter(l => l.date === dateStr);
        return {
          label: format(day, 'MMM d'),
          absences: dayAbsences.length,
          lates: dayLates.length,
          justified: dayAbsences.filter(a => a.isJustified).length + dayLates.filter(l => l.isJustified).length,
          unjustified: dayAbsences.filter(a => !a.isJustified).length + dayLates.filter(l => !l.isJustified).length,
        };
      });
    }

    if (viewMode === 'weekly') {
      const weeks = eachWeekOfInterval({ start: subWeeks(now, rangeNum), end: now }, { weekStartsOn: 1 });
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekAbsences = absences.filter(a => { const d = parseISO(a.date); return d >= weekStart && d <= weekEnd; });
        const weekLates = lates.filter(l => { const d = parseISO(l.date); return d >= weekStart && d <= weekEnd; });
        return {
          label: `${format(weekStart, 'MMM d')}`,
          absences: weekAbsences.length,
          lates: weekLates.length,
          justified: weekAbsences.filter(a => a.isJustified).length + weekLates.filter(l => l.isJustified).length,
          unjustified: weekAbsences.filter(a => !a.isJustified).length + weekLates.filter(l => !l.isJustified).length,
        };
      });
    }

    const months = eachMonthOfInterval({ start: subMonths(now, rangeNum), end: now });
    return months.map(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const monthAbsences = absences.filter(a => { const d = parseISO(a.date); return d >= monthStart && d <= monthEnd; });
      const monthLates = lates.filter(l => { const d = parseISO(l.date); return d >= monthStart && d <= monthEnd; });
      return {
        label: format(monthStart, 'MMM yyyy'),
        absences: monthAbsences.length,
        lates: monthLates.length,
        justified: monthAbsences.filter(a => a.isJustified).length + monthLates.filter(l => l.isJustified).length,
        unjustified: monthAbsences.filter(a => !a.isJustified).length + monthLates.filter(l => !l.isJustified).length,
      };
    });
  }, [absences, lates, viewMode, range]);

  const summaryData = useMemo(() => {
    const totalAbs = absences.length;
    const totalLates = lates.length;
    const justifiedAbs = absences.filter(a => a.isJustified).length;
    const justifiedLates = lates.filter(l => l.isJustified).length;
    return {
      totalAbs, totalLates, justifiedAbs, unjustifiedAbs: totalAbs - justifiedAbs,
      justifiedLates, unjustifiedLates: totalLates - justifiedLates, total: totalAbs + totalLates,
    };
  }, [absences, lates]);

  const pieData = useMemo(() => [
    { name: t('attendance.justifiedAbsences'), value: summaryData.justifiedAbs, color: COLORS.justified },
    { name: t('attendance.unjustifiedAbsences'), value: summaryData.unjustifiedAbs, color: COLORS.unjustified },
    { name: t('attendance.justifiedLates'), value: summaryData.justifiedLates, color: 'hsl(142 50% 50%)' },
    { name: t('attendance.unjustifiedLates'), value: summaryData.unjustifiedLates, color: COLORS.lates },
  ].filter(d => d.value > 0), [summaryData, t]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  const getRangeLabel = (val: string) => {
    const num = val;
    if (viewMode === 'monthly') return t('attendance.lastMonths', { count: num });
    return t('attendance.lastWeeks', { count: num });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{t('attendance.stats')}</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={viewMode} onValueChange={(v: ViewMode) => setViewMode(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t('attendance.daily')}</SelectItem>
              <SelectItem value="weekly">{t('attendance.weekly')}</SelectItem>
              <SelectItem value="monthly">{t('attendance.monthly')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">{getRangeLabel('2')}</SelectItem>
              <SelectItem value="4">{getRangeLabel('4')}</SelectItem>
              <SelectItem value="8">{getRangeLabel('8')}</SelectItem>
              <SelectItem value="12">{getRangeLabel('12')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('attendance.totalAbsences')}</p><p className="text-2xl font-bold text-destructive">{summaryData.totalAbs}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('attendance.totalLates')}</p><p className="text-2xl font-bold text-orange-500">{summaryData.totalLates}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('common.justified')}</p><p className="text-2xl font-bold text-green-600">{summaryData.justifiedAbs + summaryData.justifiedLates}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{t('common.unjustified')}</p><p className="text-2xl font-bold text-destructive">{summaryData.unjustifiedAbs + summaryData.unjustifiedLates}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t('attendance.trend')}</CardTitle></CardHeader>
          <CardContent>
            {chartData.length === 0 || chartData.every(d => d.absences === 0 && d.lates === 0) ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">{t('attendance.noIssues')} 🎉</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" angle={viewMode === 'daily' ? -45 : 0} textAnchor={viewMode === 'daily' ? 'end' : 'middle'} height={viewMode === 'daily' ? 60 : 30} />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="absences" name={t('attendance.absences')} fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lates" name={t('attendance.lates')} fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t('attendance.breakdown')}</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">{t('common.noData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label={({ value }) => `${value}`} labelLine={false}>
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend layout="vertical" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
