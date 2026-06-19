import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { markRecordApi } from '@/services/mark-record-api';
import { subjectApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, Award, BookOpen } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import type { NonOfficialMarkRecord, OfficialMarkRecord } from '@/types/mark-record';
import { useTranslation } from 'react-i18next';

interface Props {
  studentId: string;
  studentName: string;
  studentLevelId?: string;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(172 66% 50%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(200 80% 50%)',
];

export function StudentMarkStatsTab({ studentId, studentName, studentLevelId }: Props) {
  const { t } = useTranslation();
  const { data: recordsRes, isLoading } = useQuery({
    queryKey: ['mark-records', { studentId }],
    queryFn: () => markRecordApi.getAll({ page: 1, limit: 1000, studentId }),
  });
  const { data: settingsRes } = useQuery({
    queryKey: ['mark-record-settings'],
    queryFn: () => markRecordApi.getSettings(),
  });
  const { data: subjectsRes } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll({ page: 1, limit: 100 }),
  });

  const records = recordsRes?.data || [];
  const settings = settingsRes?.data;
  const subjects = subjectsRes?.data || [];

  const officialRecords = records.filter(r => r.isOfficial) as OfficialMarkRecord[];
  const nonOfficialRecords = records.filter(r => !r.isOfficial) as NonOfficialMarkRecord[];

  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || id;
  const getTypeName = (typeId: string) => settings?.types.find(t => t.id === typeId)?.name || typeId;

  const nonOfficialByType = useMemo(() => {
    const map = new Map<string, { count: number; totalScore: number; totalMax: number }>();
    nonOfficialRecords.forEach(r => {
      const existing = map.get(r.typeId) || { count: 0, totalScore: 0, totalMax: 0 };
      existing.count++; existing.totalScore += r.score; existing.totalMax += r.maxScore;
      map.set(r.typeId, existing);
    });
    return Array.from(map.entries()).map(([typeId, stats]) => ({
      typeId, typeName: getTypeName(typeId), ...stats,
      average: stats.totalMax > 0 ? Math.round((stats.totalScore / stats.totalMax) * 100) : 0,
    }));
  }, [nonOfficialRecords, settings]);

  const nonOfficialBySubject = useMemo(() => {
    const map = new Map<string, { count: number; totalScore: number; totalMax: number }>();
    nonOfficialRecords.forEach(r => {
      const existing = map.get(r.subjectId) || { count: 0, totalScore: 0, totalMax: 0 };
      existing.count++; existing.totalScore += r.score; existing.totalMax += r.maxScore;
      map.set(r.subjectId, existing);
    });
    return Array.from(map.entries()).map(([subjectId, stats]) => ({
      subjectId, subjectName: getSubjectName(subjectId), ...stats,
      average: stats.totalMax > 0 ? Math.round((stats.totalScore / stats.totalMax) * 100) : 0,
    }));
  }, [nonOfficialRecords, subjects]);

  const officialBySubject = useMemo(() => {
    return officialRecords.map(r => {
      const template = settings?.officialTemplates.find(t => t.id === r.templateId);
      const totalScore = Object.values(r.scores).reduce((a, b) => a + b, 0);
      const maxScore = template?.columns.reduce((a, c) => a + c.maxScore, 0) || 0;
      const columns = template?.columns.map(col => ({
        name: col.name, score: r.scores[col.id] ?? 0, maxScore: col.maxScore,
        percentage: col.maxScore > 0 ? Math.round(((r.scores[col.id] ?? 0) / col.maxScore) * 100) : 0,
      })) || [];
      return {
        subjectId: r.subjectId, subjectName: getSubjectName(r.subjectId),
        totalScore, maxScore, percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
        columns, date: r.date,
      };
    });
  }, [officialRecords, settings, subjects]);

  const overallNonOfficial = useMemo(() => {
    if (nonOfficialRecords.length === 0) return null;
    const totalScore = nonOfficialRecords.reduce((a, r) => a + r.score, 0);
    const totalMax = nonOfficialRecords.reduce((a, r) => a + r.maxScore, 0);
    return {
      count: nonOfficialRecords.length,
      average: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
      highest: Math.max(...nonOfficialRecords.map(r => r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0)),
      lowest: Math.min(...nonOfficialRecords.map(r => r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0)),
    };
  }, [nonOfficialRecords]);

  const overallOfficial = useMemo(() => {
    if (officialRecords.length === 0) return null;
    const totals = officialRecords.map(r => {
      const template = settings?.officialTemplates.find(t => t.id === r.templateId);
      const totalScore = Object.values(r.scores).reduce((a, b) => a + b, 0);
      const maxScore = template?.columns.reduce((a, c) => a + c.maxScore, 0) || 0;
      return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    });
    return {
      count: officialRecords.length,
      average: Math.round(totals.reduce((a, b) => a + b, 0) / totals.length),
      highest: Math.max(...totals), lowest: Math.min(...totals),
    };
  }, [officialRecords, settings]);

  const subjectBarData = useMemo(() => nonOfficialBySubject.map(s => ({ name: s.subjectName, average: s.average, count: s.count })), [nonOfficialBySubject]);
  const radarData = useMemo(() => nonOfficialBySubject.map(s => ({ subject: s.subjectName, score: s.average, fullMark: 100 })), [nonOfficialBySubject]);
  const trendData = useMemo(() => [...nonOfficialRecords].sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ date: r.date, score: r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0, subject: getSubjectName(r.subjectId) })), [nonOfficialRecords, subjects]);
  const typePieData = useMemo(() => nonOfficialByType.map((t, i) => ({ name: t.typeName, value: t.count, color: CHART_COLORS[i % CHART_COLORS.length] })), [nonOfficialByType]);
  const officialBarData = useMemo(() => officialBySubject.length === 0 ? [] : officialBySubject.flatMap(s => s.columns.map(col => ({ subject: s.subjectName, column: col.name, score: col.percentage }))), [officialBySubject]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{nonOfficialRecords.length}</p><p className="text-xs text-muted-foreground">{t('marks.nonOfficialMarks')}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Award className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{officialRecords.length}</p><p className="text-xs text-muted-foreground">{t('marks.officialMarks')}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{overallNonOfficial?.average ?? '—'}%</p><p className="text-xs text-muted-foreground">{t('marks.nonOfficialAvg')}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><BarChart3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{overallOfficial?.average ?? '—'}%</p><p className="text-xs text-muted-foreground">{t('marks.officialAvg')}</p></CardContent></Card>
      </div>

      {subjectBarData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{t('marks.subjectPerformance')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={subjectBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`${value}%`, t('marks.average')]} />
                  <Bar dataKey="average" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {radarData.length >= 3 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t('marks.strengthsRadar')}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid className="stroke-muted" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name={t('common.score')} dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {trendData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">{t('marks.scoreTrend')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number, _: any, props: any) => [`${value}%`, props.payload.subject]} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {typePieData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t('marks.recordsByType')}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={typePieData} cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" label={({ value }) => value} labelLine={false}>
                      {typePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {nonOfficialByType.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('marks.nonOfficialByType')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {nonOfficialByType.map(stat => (
              <div key={stat.typeId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stat.typeName}</span>
                  <span className="text-muted-foreground">{stat.count} {t('common.records')} · {stat.totalScore}/{stat.totalMax} ({stat.average}%)</span>
                </div>
                <Progress value={stat.average} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {nonOfficialBySubject.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('marks.nonOfficialBySubject')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {nonOfficialBySubject.map(stat => (
              <div key={stat.subjectId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stat.subjectName}</span>
                  <span className="text-muted-foreground">{stat.count} {t('common.records')} · {stat.totalScore}/{stat.totalMax} ({stat.average}%)</span>
                </div>
                <Progress value={stat.average} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {officialBySubject.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('marks.officialBreakdown')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {officialBySubject.map((stat, idx) => (
              <div key={idx} className="space-y-2 p-3 rounded-md border">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{stat.subjectName}</span>
                  <Badge variant={stat.percentage >= 60 ? 'default' : 'destructive'}>{stat.totalScore}/{stat.maxScore} ({stat.percentage}%)</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {stat.columns.map((col, ci) => (
                    <div key={ci} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{col.name}</span>
                        <span>{col.score}/{col.maxScore}</span>
                      </div>
                      <Progress value={col.percentage} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {records.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('marks.noRecordsFor', { name: studentName })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
